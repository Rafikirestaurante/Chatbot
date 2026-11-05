import { expect, it } from "vitest";
import { accessErrorMessage } from "./accessErrors";
it("distinguishes Google popup failure from password credentials", () => {
  expect(accessErrorMessage({ code: "auth/popup-blocked" })).toContain("ventanas emergentes");
  expect(accessErrorMessage({ code: "auth/invalid-credential" })).toContain("contraseña de Gmail");
});
it("identifies profile failures after successful authentication", () => {
  expect(accessErrorMessage({ code: "permission-denied" }, "profile")).toContain("Google inició");
  expect(accessErrorMessage({ code: "functions/internal" }, "profile")).toContain("perfil/funciones");
});
it("never displays raw provider errors", () => {
  expect(accessErrorMessage(new Error("private-provider-details"))).not.toContain("private-provider-details");
});
