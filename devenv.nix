{ pkgs, lib, config, inputs, ... }:

{
  languages.javascript.enable = true;
  languages.javascript.nodejs.enable = true;
  languages.javascript.bun.enable = true;
  languages.javascript.bun.install.enable = true;

  processes.dev.exec = "bun run dev";

  enterShell = ''
    echo "node $(node --version) · bun v$(bun --version)"
  '';

  enterTest = ''
    node --version | grep --color=auto "${pkgs.nodejs.version}"
    bun --version | grep --color=auto "${pkgs.bun.version}"
  '';
}
