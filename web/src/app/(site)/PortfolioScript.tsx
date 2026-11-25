"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { initPortfolio } from "./portfolio-script";

export default function PortfolioScript() {
  useEffect(() => {
    const w = window as unknown as { __arhanInit?: boolean };
    if (w.__arhanInit) return; // React strict mode runs effects twice in dev
    w.__arhanInit = true;
    initPortfolio(THREE);
  }, []);
  return null;
}
