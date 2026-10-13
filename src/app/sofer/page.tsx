import type { Metadata } from "next";
import { DriverApp } from "./DriverApp";

export const metadata: Metadata = { title: "Nobil Prest · Șofer" };

export default function DriverPage() {
  return <DriverApp />;
}
