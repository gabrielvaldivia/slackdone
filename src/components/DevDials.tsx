"use client";

import "dialkit/styles.css";
import { DialRoot } from "dialkit";

export function DevDials() {
  if (process.env.NODE_ENV !== "development") return null;
  return <DialRoot position="bottom-right" />;
}
