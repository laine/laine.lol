/**
 * Colored language file icons using Catppuccin Mocha palette
 * with real brand SVG icons from react-icons.
 */
import {
  SiRust, SiPython, SiJavascript, SiTypescript, SiGo,
  SiRuby, SiPhp, SiSwift, SiKotlin, SiLua, SiHaskell,
  SiElixir, SiErlang, SiScala, SiGraphql, SiMarkdown,
  SiCplusplus, SiGnubash, SiPerl, SiC, SiCss, SiJson,
  SiHtml5, SiYaml, SiOdin,
} from "react-icons/si";
import { DiJava } from "react-icons/di";
import { TbSql, TbRegex, TbTerminal, TbFileText } from "react-icons/tb";
import { FileText } from "lucide-react";
import type { IconType } from "react-icons";

// Catppuccin Mocha palette
const cat = {
  rosewater: "#f5e0dc",
  flamingo:  "#f2cdcd",
  pink:      "#f5c2e7",
  mauve:     "#cba6f7",
  red:       "#f38ba8",
  maroon:    "#eba0ac",
  peach:     "#fab387",
  yellow:    "#f9e2af",
  green:     "#a6e3a1",
  teal:      "#94e2d5",
  sky:       "#89dceb",
  sapphire:  "#74c7ec",
  blue:      "#89b4fa",
  lavender:  "#b4befe",
  subtext0:  "#a6adc8",
};

type LangEntry = { icon: IconType; color: string };

const iconMap: Record<string, LangEntry> = {
  javascript:  { icon: SiJavascript,  color: cat.yellow },
  jsx:         { icon: SiJavascript,  color: cat.sky },
  typescript:  { icon: SiTypescript,  color: cat.blue },
  tsx:         { icon: SiTypescript,  color: cat.sapphire },
  html:        { icon: SiHtml5,       color: cat.peach },
  css:         { icon: SiCss,         color: cat.sapphire },
  json:        { icon: SiJson,        color: cat.yellow },
  graphql:     { icon: SiGraphql,     color: cat.pink },

  rust:        { icon: SiRust,        color: cat.peach },
  c:           { icon: SiC,           color: cat.blue },
  cpp:         { icon: SiCplusplus,   color: cat.blue },
  csharp:      { icon: SiCplusplus,   color: cat.mauve },
  go:          { icon: SiGo,          color: cat.teal },
  swift:       { icon: SiSwift,       color: cat.peach },
  kotlin:      { icon: SiKotlin,      color: cat.mauve },
  java:        { icon: DiJava,        color: cat.maroon },

  python:      { icon: SiPython,      color: cat.blue },
  ruby:        { icon: SiRuby,        color: cat.red },
  php:         { icon: SiPhp,         color: cat.lavender },
  perl:        { icon: SiPerl,        color: cat.teal },
  lua:         { icon: SiLua,         color: cat.blue },
  bash:        { icon: SiGnubash,     color: cat.green },
  powershell:  { icon: TbTerminal,    color: cat.sapphire },

  haskell:     { icon: SiHaskell,     color: cat.mauve },
  elixir:      { icon: SiElixir,      color: cat.mauve },
  erlang:      { icon: SiErlang,      color: cat.red },
  scala:       { icon: SiScala,       color: cat.red },
  lisp:        { icon: TbFileText,    color: cat.green },

  sql:         { icon: TbSql,         color: cat.peach },
  yaml:        { icon: SiYaml,        color: cat.red },
  markdown:    { icon: SiMarkdown,    color: cat.sky },
  regex:       { icon: TbRegex,       color: cat.green },

  odin:        { icon: SiOdin,        color: cat.sapphire },
  pascal:      { icon: TbFileText,    color: cat.yellow },
};

export function LanguageIcon({ language, className = "h-4 w-4 shrink-0" }: { language: string; className?: string }) {
  const entry = iconMap[language];
  if (entry) {
    const Icon = entry.icon;
    return <Icon className={className} style={{ color: entry.color }} />;
  }
  return <FileText className={className} style={{ color: cat.subtext0 }} />;
}
