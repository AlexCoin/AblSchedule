import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ABL • Расписание турнира",
  description: "Согласование расписания баскетбольного турнира на Профсоюзной",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
