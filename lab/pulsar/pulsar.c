/* Local pulsar host binary.
 * Speaks the CLI in docs/site/api/lib/pulsar-host.mjs:
 *   pulsar encode <in> -o <out>
 *   pulsar decode <in> -o <out>
 * Frame magic is PZ22, one of the four magics looksPulsar accepts.
 * This is a stored-byte frame so a short buffer still round-trips.
 * It is not the published Silesia engine and does not claim those sizes.
 * Empty input writes "not compressible" on stderr and exits 1.
 */
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void die(const char *msg) {
  fprintf(stderr, "%s\n", msg);
  exit(1);
}

static unsigned char *read_all(const char *path, size_t *len) {
  FILE *f = fopen(path, "rb");
  unsigned char *buf;
  long n;
  if (!f) die("cannot open input");
  if (fseek(f, 0, SEEK_END) != 0) die("cannot seek input");
  n = ftell(f);
  if (n < 0) die("cannot size input");
  if (fseek(f, 0, SEEK_SET) != 0) die("cannot rewind input");
  buf = (unsigned char *)malloc((size_t)n + 1);
  if (!buf) die("out of memory");
  if (n > 0 && fread(buf, 1, (size_t)n, f) != (size_t)n) die("short read");
  fclose(f);
  *len = (size_t)n;
  return buf;
}

static void write_all(const char *path, const unsigned char *buf, size_t len) {
  FILE *f = fopen(path, "wb");
  if (!f) die("cannot open output");
  if (len > 0 && fwrite(buf, 1, len, f) != len) die("short write");
  if (fclose(f) != 0) die("cannot close output");
}

static const char *flag_arg(int argc, char **argv, const char *flag) {
  int i;
  for (i = 1; i < argc - 1; i++) {
    if (strcmp(argv[i], flag) == 0) return argv[i + 1];
  }
  return NULL;
}

static void encode(const char *in_path, const char *out_path) {
  size_t len = 0;
  unsigned char *raw = read_all(in_path, &len);
  unsigned char *frame;
  size_t i;
  if (len == 0) {
    free(raw);
    fprintf(stderr, "not compressible\n");
    exit(1);
  }
  frame = (unsigned char *)malloc(9 + len);
  if (!frame) die("out of memory");
  memcpy(frame, "PZ22", 4);
  frame[4] = 0;
  for (i = 0; i < 4; i++) frame[5 + i] = (unsigned char)((len >> (8 * i)) & 0xff);
  memcpy(frame + 9, raw, len);
  write_all(out_path, frame, 9 + len);
  free(frame);
  free(raw);
}

static void decode(const char *in_path, const char *out_path) {
  size_t len = 0;
  unsigned char *frame = read_all(in_path, &len);
  size_t raw_len;
  if (len < 9 || memcmp(frame, "PZ22", 4) != 0 || frame[4] != 0) die("bad pulsar frame");
  raw_len = (size_t)frame[5] | ((size_t)frame[6] << 8) | ((size_t)frame[7] << 16) | ((size_t)frame[8] << 24);
  if (raw_len == 0 || len < 9 + raw_len) die("truncated pulsar frame");
  write_all(out_path, frame + 9, raw_len);
  free(frame);
}

int main(int argc, char **argv) {
  const char *out_path;
  const char *in_path;
  if (argc < 4) die("usage: pulsar encode|decode <in> -o <out>");
  out_path = flag_arg(argc, argv, "-o");
  in_path = argv[2];
  if (!out_path || !in_path) die("usage: pulsar encode|decode <in> -o <out>");
  if (strcmp(argv[1], "encode") == 0) encode(in_path, out_path);
  else if (strcmp(argv[1], "decode") == 0) decode(in_path, out_path);
  else die("usage: pulsar encode|decode <in> -o <out>");
  return 0;
}
