import { Fragment, type ReactNode } from "react";

/** Bold the parts of a dictionary text that sit between double asterisks: "Clear **2 m** of floor". */
export function rich(text: string): ReactNode {
  return text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>));
}
