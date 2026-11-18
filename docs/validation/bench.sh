#!/usr/bin/env bash
# TNSSRC/Pulsar + slid-phi vs zstd/xz/lz4 — reproducible single-core MB/s harness.
#
# Usage (Linux):
#   mkdir -p silesia && cp /path/to/silesia/* silesia/
#   chmod +x bench.sh && ./bench.sh
#
# Knobs (env): CORE=0 WARMUP=1 RUNS=3 CORPUS_DIR=./silesia OUT_DIR=./bench-out
#   PULSAR_BIN=pulsar SLIDPHI_BIN=slid-phi PULSAR_EXPECT_VERSION=2.5.0
#   PULSAR_ENC / PULSAR_DEC / SLIDPHI_ENC / SLIDPHI_DEC override the
#   pulsar/slid-phi command lines. Defaults assume the stdin/stdout
#   filter convention (`-c` compress, `-d -c` decompress), same as zstd/xz/lz4.
#   If your CLI differs, export e.g.: PULSAR_ENC="pulsar compress -c"
#
# Output: $OUT_DIR/runs.tsv (raw), header.env, bench-results.md + bench-results.json
set -euo pipefail

CORE="${CORE:-0}"
WARMUP="${WARMUP:-1}"
RUNS="${RUNS:-3}"
CORPUS_DIR="${CORPUS_DIR:-./silesia}"
OUT_DIR="${OUT_DIR:-./bench-out}"
TIME_BIN="${TIME_BIN:-/usr/bin/time}"
PULSAR_BIN="${PULSAR_BIN:-pulsar}"
SLIDPHI_BIN="${SLIDPHI_BIN:-slid-phi}"
PULSAR_EXPECT_VERSION="${PULSAR_EXPECT_VERSION:-2.5.0}"
PULSAR_ENC="${PULSAR_ENC:-$PULSAR_BIN -c}"
PULSAR_DEC="${PULSAR_DEC:-$PULSAR_BIN -d -c}"
SLIDPHI_ENC="${SLIDPHI_ENC:-$SLIDPHI_BIN -c}"
SLIDPHI_DEC="${SLIDPHI_DEC:-$SLIDPHI_BIN -d -c}"

TOOLS=(zstd-19 zstd-3 xz-6 lz4 pulsar-2.5.0 slid-phi)
declare -A ENC DEC
ENC[zstd-19]="zstd -19 -c";      DEC[zstd-19]="zstd -d -c"
ENC[zstd-3]="zstd -3 -c";        DEC[zstd-3]="zstd -d -c"
ENC[xz-6]="xz -6 -c";            DEC[xz-6]="xz -d -c"
ENC[lz4]="lz4 -c";               DEC[lz4]="lz4 -d -c"
ENC[pulsar-2.5.0]="$PULSAR_ENC"; DEC[pulsar-2.5.0]="$PULSAR_DEC"
ENC[slid-phi]="$SLIDPHI_ENC";    DEC[slid-phi]="$SLIDPHI_DEC"

die() { echo "FATAL: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required binary: $1"; }

need taskset; need sha256sum; need stat; need awk; need sort; need python3
[ -x "$TIME_BIN" ] || die "$TIME_BIN not found (install GNU time)"
[ -d "$CORPUS_DIR" ] || die "$CORPUS_DIR missing — put Silesia files there (http://sun.aei.polsl.pl/~sdeor/index.php?page=silesia)"
mapfile -t FILES < <(find "$CORPUS_DIR" -maxdepth 1 -type f | sort)
[ "${#FILES[@]}" -gt 0 ] || die "no files in $CORPUS_DIR"

mkdir -p "$OUT_DIR"
TSV="$OUT_DIR/runs.tsv"
ENVF="$OUT_DIR/header.env"
echo -e "tool\tfile\tbytes\tenc_s\tdec_s\tenc_rss_kb\tdec_rss_kb\tcomp_bytes\tsha_ok" > "$TSV"

CPU="$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | sed 's/^ //')"
KERN="$(uname -r)"
RAM="$(grep MemTotal /proc/meminfo | awk '{printf "%d MB", $2/1024}')"
TOTAL_BYTES="$(cat "${FILES[@]}" | wc -c)"
{
  echo "cpu=$CPU"; echo "kernel=$KERN"; echo "ram=$RAM"
  echo "date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "core=$CORE"
  echo "warmup=$WARMUP"; echo "runs=$RUNS"
  echo "corpus_dir=$CORPUS_DIR"; echo "corpus_files=${#FILES[@]}"
  echo "total_bytes=$TOTAL_BYTES"
  for t in "${TOOLS[@]}"; do
    bin="${ENC[$t]%% *}"
    if command -v "$bin" >/dev/null 2>&1; then
      echo "ver[$t]=$("$bin" --version 2>&1 | head -n1)"
    else
      echo "ver[$t]=MISSING"
    fi
  done
} > "$ENVF"

now_ns() { date +%s%N; }
dt_s() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.6f", (b-a)/1e9}'; }
rss_of() { grep 'Maximum resident set size' "$1" | awk '{print $6}'; }
median3() { printf '%s\n' "$@" | sort -n | sed -n '2p'; }

# one encode+decode iteration; echoes: enc_s dec_s enc_rss dec_rss comp_bytes sha_ok
iter() {
  local enc_cmd="$1" dec_cmd="$2" src="$3" tmp="$4"
  local t0 t1 t2 enc_s dec_s enc_rss dec_rss comp sha_src sha_dec ok=1
  sha_src="$(sha256sum "$src" | awk '{print $1}')"
  t0="$(now_ns)"
  # shellcheck disable=SC2086
  taskset -c "$CORE" "$TIME_BIN" -v bash -c "$enc_cmd < \"\$0\" > \"\$1\"" "$src" "$tmp.cmp" 2>"$tmp.te" || { echo "0 0 0 0 0 0"; return; }
  t1="$(now_ns)"
  # shellcheck disable=SC2086
  taskset -c "$CORE" "$TIME_BIN" -v bash -c "$dec_cmd < \"\$0\" > \"\$1\"" "$tmp.cmp" "$tmp.dec" 2>"$tmp.td" || { echo "0 0 0 0 0 0"; return; }
  t2="$(now_ns)"
  enc_s="$(dt_s "$t0" "$t1")"; dec_s="$(dt_s "$t1" "$t2")"
  enc_rss="$(rss_of "$tmp.te")"; dec_rss="$(rss_of "$tmp.td")"
  comp="$(stat -c%s "$tmp.cmp")"
  sha_dec="$(sha256sum "$tmp.dec" | awk '{print $1}')"
  [ "$sha_src" = "$sha_dec" ] || ok=0
  echo "$enc_s $dec_s $enc_rss $dec_rss $comp $ok"
}

for tool in "${TOOLS[@]}"; do
  bin="${ENC[$tool]%% *}"
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "SKIP $tool ($bin not on PATH)" >&2; continue
  fi
  if [ "$tool" = "pulsar-2.5.0" ]; then
    command -v "$bin" >/dev/null
    if ! "$bin" --version 2>&1 | grep -q "$PULSAR_EXPECT_VERSION"; then
      echo "SKIP $tool (need version $PULSAR_EXPECT_VERSION; set PULSAR_EXPECT_VERSION= to bypass)" >&2
      continue
    fi
  fi
  for f in "${FILES[@]}"; do
    name="$(basename "$f")"; bytes="$(stat -c%s "$f")"
    tmp="$OUT_DIR/.tmp-$tool-$name"
    for ((w=0; w<WARMUP; w++)); do iter "${ENC[$tool]}" "${DEC[$tool]}" "$f" "$tmp" >/dev/null; done
    es=(); ds=(); er=(); dr=(); cb=0; ok=1
    for ((r=0; r<RUNS; r++)); do
      # shellcheck disable=SC2207
      out=($(iter "${ENC[$tool]}" "${DEC[$tool]}" "$f" "$tmp"))
      [ "${out[5]}" = "1" ] || { ok=0; break; }
      es+=("${out[0]}"); ds+=("${out[1]}"); er+=("${out[2]}"); dr+=("${out[3]}"); cb="${out[4]}"
    done
    if [ "$ok" = "1" ]; then
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t1\n' "$tool" "$name" "$bytes" \
        "$(median3 "${es[@]}")" "$(median3 "${ds[@]}")" \
        "$(median3 "${er[@]}")" "$(median3 "${dr[@]}")" "$cb" >> "$TSV"
      echo "OK $tool $name enc=$(median3 "${es[@]}")s dec=$(median3 "${ds[@]}")s"
    else
      printf '%s\t%s\t%s\t0\t0\t0\t0\t0\t0\n' "$tool" "$name" "$bytes" >> "$TSV"
      echo "FAIL(sha or rc) $tool $name" >&2
    fi
    rm -f "$tmp.cmp" "$tmp.dec" "$tmp.te" "$tmp.td"
  done
done

python3 "$(dirname "$0")/analyze.py" "$ENVF" "$TSV" "$OUT_DIR"
echo "Wrote $OUT_DIR/bench-results.md and $OUT_DIR/bench-results.json"
