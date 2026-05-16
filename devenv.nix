{ pkgs, lib, config, inputs, ... }:

{
  languages.javascript.enable = true;
  languages.javascript.nodejs.enable = true;
  languages.javascript.pnpm.enable = true;
  languages.javascript.pnpm.install.enable = true;

  processes.dev.exec = "pnpm --dir=site dev";

  enterShell = ''
    echo "node $(node --version) · pnpm v$(pnpm --version)"
  '';

  enterTest = ''
    node --version | grep --color=auto "${pkgs.nodejs.version}"
    pnpm --version | grep --color=auto "${pkgs.pnpm.version}"
  '';
}
