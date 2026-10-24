import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Item Search",
  description: "Client-side search and filtering over 100,000 items with a virtualized list.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
