"use client";
export default function PrintButton() {
  return <button className="b noprint" type="button" onClick={() => window.print()}>Print or save as PDF</button>;
}
