import { redirect } from "next/navigation";

/** 既存URLは /works?sale=…。互換のため /sale からリダイレクト */
export default function SalePage() {
  redirect("/works?sale=1");
}
