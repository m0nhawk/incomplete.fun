import { initDarkroom } from "./darkroom";
import { initSnapshotExport } from "./snapshot-export";

for (const app of document.querySelectorAll<HTMLElement>(".canvas-app")) {
  initDarkroom(app);
  initSnapshotExport(app);
}
