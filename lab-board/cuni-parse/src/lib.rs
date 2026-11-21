/// A small harness that finds the top-level declaration in four languages.
/// It does not download tree-sitter grammars. The shapes it knows are the
/// ones the lab needs for a silent-error pass: function, contract, and method.

#[derive(Debug, PartialEq, Eq)]
pub struct Decl {
    pub language: &'static str,
    pub kind: &'static str,
    pub name: String,
}

pub fn parse_decl(language: &str, source: &str) -> Option<Decl> {
    let (kind, name) = match language {
        "python" => after_keyword(source, "def ", "function")?,
        "typescript" => after_keyword(source, "function ", "function")?,
        "solidity" => after_keyword(source, "contract ", "contract")?,
        "go" => after_keyword(source, "func ", "function")?,
        _ => return None,
    };
    Some(Decl {
        language: match language {
            "python" => "python",
            "typescript" => "typescript",
            "solidity" => "solidity",
            "go" => "go",
            _ => "unknown",
        },
        kind,
        name,
    })
}

fn after_keyword<'a>(source: &'a str, keyword: &str, kind: &'static str) -> Option<(&'static str, String)> {
    let start = source.find(keyword)? + keyword.len();
    let rest = &source[start..];
    let name: String = rest
        .chars()
        .take_while(|ch| ch.is_ascii_alphanumeric() || *ch == '_')
        .collect();
    if name.is_empty() {
        return None;
    }
    Some((kind, name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_languages() {
        assert_eq!(parse_decl("python", "def spend():\n  pass").unwrap().name, "spend");
        assert_eq!(parse_decl("typescript", "function spend() {}").unwrap().name, "spend");
        assert_eq!(parse_decl("solidity", "contract Spend {}").unwrap().kind, "contract");
        assert_eq!(parse_decl("go", "func Spend() {}").unwrap().name, "Spend");
    }
}
