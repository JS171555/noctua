import "@testing-library/jest-dom/vitest";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});
