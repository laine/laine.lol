import { describe, it, expect } from "vitest";
import {
  detectLanguage,
  getLanguageSuggestions,
  getAlternativeLanguageSuggestions,
  getAvailableLanguageOptions,
} from "../language-detector";

const samples: Record<string, string> = {
  rust: `use std::collections::HashMap;

pub fn count(words: &[&str]) -> HashMap<String, usize> {
    let mut map = HashMap::new();
    for w in words {
        *map.entry(w.to_string()).or_insert(0) += 1;
    }
    map
}`,
  go: `package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "hello")
    })
}`,
  python: `class Stack:
    def __init__(self):
        self.items = []

    def push(self, item):
        self.items.append(item)

    def pop(self):
        return self.items.pop() if self.items else None`,
  typescript: `interface User {
  id: number;
  name: string;
}

type UserMap = Record<number, User>;

export function index(users: User[]): UserMap {
  const out: UserMap = {};
  for (const u of users) out[u.id] = u;
  return out;
}`,
  markdown: `# Title

Some **bold** text and a [link](https://example.com).

- item one
- item two

> quoted`,
  json: `{
  "name": "rustybin",
  "version": "1.0.0",
  "private": true,
  "dependencies": { "react": "^18.3.1" }
}`,
  sql: `SELECT u.id, u.name, COUNT(p.id) AS pastes
FROM users u
LEFT JOIN pastes p ON p.user_id = u.id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name
ORDER BY pastes DESC;`,
  html: `<!DOCTYPE html>
<html>
  <head><title>Test</title></head>
  <body>
    <div class="container"><p>Hello</p></div>
  </body>
</html>`,
  css: `.container {
  display: flex;
  margin: 0 auto;
  padding: 1rem 2rem;
}

a:hover { color: #c77f81; }`,
  java: `import java.util.ArrayList;

public class Main {
    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            sb.append(i);
        }
        return sb.toString();
    }

    public void run(String[] args) throws Exception {
        System.out.println(new Main());
    }
}`,
  csharp: `using System;
using System.Linq;

namespace Demo
{
    public class Program
    {
        public void Run(string[] args)
        {
            var xs = new[] { 1, 2, 3 }.Where(x => x > 1).ToList();
            Console.WriteLine(xs.Count);
        }
    }
}`,
  cpp: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3};
    for (auto& x : v) {
        std::cout << x << std::endl;
    }
    return 0;
}`,
  bash: `#!/bin/bash
set -euo pipefail

for f in *.log; do
  if [[ -s "$f" ]]; then
    echo "compressing $f"
    gzip "$f"
  fi
done`,
  yaml: `server:
  host: 0.0.0.0
  port: 8080
  tls:
    enabled: true
    cert: /etc/ssl/cert.pem
database:
  url: postgres://localhost/app
  pool_size: 10`,
};

describe("language-detector", () => {
  for (const [expected, code] of Object.entries(samples)) {
    it(`detects ${expected}`, () => {
      expect(detectLanguage(code)).toBe(expected);
    });
  }

  it("returns unknown for empty input", () => {
    expect(detectLanguage("")).toBe("unknown");
    expect(getLanguageSuggestions("")).toEqual([]);
  });

  it("returns sorted, capped suggestions with display names", () => {
    const suggestions = getLanguageSuggestions(samples.typescript, 3);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].relevance).toBeGreaterThanOrEqual(
        suggestions[i].relevance
      );
    }
    expect(suggestions[0]).toMatchObject({
      language: "typescript",
      displayName: "TypeScript",
    });
  });

  it("alternative suggestions exclude the primary language", () => {
    const alts = getAlternativeLanguageSuggestions(samples.rust);
    expect(alts.map((s) => s.language)).not.toContain("rust");
  });

  it("lists all selectable languages", () => {
    const values = getAvailableLanguageOptions().map((o) => o.value);
    expect(values).toContain("html");
    expect(values).toContain("markdown");
    expect(values).toHaveLength(18);
  });
});
