import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DoujinFanzaGuideButton,
  DoujinFirstPurchaseGuideTracker,
  DoujinGuideStep,
} from "@/components/doujin/DoujinFirstPurchaseGuideClient";
import { DoujinCircleLinks } from "@/components/doujin/DoujinCircleLinks";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { buildDoujinAffiliateUrl, isValidDoujinAffiliateUrl } from "@/lib/doujin/affiliate";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import { getDoujinWorkById } from "@/lib/doujin/catalog";
import { formatDoujinPrice, DOUJIN_PLACEHOLDER_IMAGE } from "@/lib/doujin/format";
import {
  buildDoujinFirstTimeFanzaGoHref,
  isDoujinFirstTimeGuideEnabled,
} from "@/lib/doujin/first-time-guide";

export const metadata: Metadata = {
  title: "初めてFANZAを利用する方へ",
  description:
    "FANZAを初めて利用する人向けの購入手順ガイドです。このページを見ながら別タブで進めてください。",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

type PageProps = {
  searchParams: Promise<{ workId?: string | string[] }>;
};

const FANZA_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover";

const STEP_CARD_CLASS =
  "rounded-lg border border-border bg-white p-5 sm:p-6";

const NOTICE_TEXT =
  "表示される画面は、ログイン状態や購入状況によって異なる場合があります。";

const PAYMENT_METHODS = [
  {
    name: "クレジットカード",
    description:
      "クレジットカードを選択し、画面の案内に沿ってカード情報を入力します。利用可能ブランドはFANZA側の画面に表示される内容を優先してください。",
  },
  {
    name: "PayPay",
    description: "PayPayを選択し、表示される案内に沿って支払います。",
  },
  {
    name: "ペイディ",
    description:
      "ペイディを選択すると、コンビニ払いや銀行振込などを利用できる場合があります。利用条件はFANZA・ペイディ側の最新表示に従ってください。",
  },
  {
    name: "メルペイ",
    description: "メルペイを選択し、画面の案内に沿って支払います。",
  },
  {
    name: "DMMポイント",
    description:
      "あらかじめチャージしたDMMポイントを使って支払えます。チャージ方法は時期や環境により変わることがあるため、FANZA側の表示を確認してください。",
  },
] as const;

function FanzaButtonBlock({
  hasAffiliate,
  href,
  align = "center",
  maxWidthClass = "max-w-md",
}: {
  hasAffiliate: boolean;
  href: string;
  align?: "center" | "start";
  maxWidthClass?: string;
}) {
  const wrapClass =
    align === "start"
      ? `mt-5 flex w-full flex-col items-stretch gap-2 sm:mt-5 sm:max-w-[420px] ${maxWidthClass}`
      : `flex w-full flex-col items-center gap-2 ${maxWidthClass}`;
  const noticeClass =
    align === "start"
      ? "text-center text-xs leading-relaxed text-muted sm:text-left"
      : "text-center text-xs leading-relaxed text-muted";

  return (
    <div className={wrapClass}>
      {hasAffiliate ? (
        <DoujinFanzaGuideButton href={href} className={FANZA_BUTTON_CLASS}>
          この作品を見る
        </DoujinFanzaGuideButton>
      ) : (
        <span className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-md border border-border bg-surface px-5 py-3 text-sm font-bold text-muted">
          リンク準備中
        </span>
      )}
      <p className={noticeClass}>{NOTICE_TEXT}</p>
    </div>
  );
}

export default async function DoujinFirstPurchaseGuidePage({
  searchParams,
}: PageProps) {
  if (!isDoujinFirstTimeGuideEnabled()) {
    notFound();
  }

  const params = await searchParams;
  const workIdRaw = params.workId;
  const workId = Array.isArray(workIdRaw)
    ? workIdRaw[0]?.trim()
    : workIdRaw?.trim();

  if (!workId) {
    notFound();
  }

  const work = getDoujinWorkById(workId);
  if (!work) {
    notFound();
  }

  const affiliateUrl = buildDoujinAffiliateUrl(work);
  const hasAffiliate = isValidDoujinAffiliateUrl(affiliateUrl);
  const fanzaGoHref = buildDoujinFirstTimeFanzaGoHref(work.id);
  const imageUrl = getDoujinCardImage(work) || DOUJIN_PLACEHOLDER_IMAGE;
  const price = formatDoujinPrice(work.price);
  const hasCircle =
    Boolean(work.circleName) || (work.circleNames?.length ?? 0) > 0;

  return (
    <DoujinPageLayout showSidebar={false}>
      <DoujinFirstPurchaseGuideTracker workId={work.id} title={work.title}>
        {/* stickyヘッダー分の余白を確保し、タイトルが隠れないようにする */}
        <article className="mx-auto w-full max-w-[760px] scroll-mt-36 pt-2 sm:scroll-mt-28 sm:pt-4">
          <p className="text-sm text-muted">
            <Link href={`/doujin/works/${work.id}`} className="hover:underline">
              ← 作品詳細へ戻る
            </Link>
          </p>

          <header className="mt-5 sm:mt-6">
            <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              初めてFANZAを利用する方へ
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              このページを見ながら、FANZAでの会員登録から購入まで進められます。
              <br />
              このページは閉じず、別タブでFANZAを開いて見比べながら進めてください。
            </p>
          </header>

          <section
            aria-label="対象作品"
            className="mx-auto mt-8 w-full max-w-[760px] overflow-hidden rounded-lg border border-border bg-surface p-4 sm:p-5"
          >
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
              {/* カード用クラスは使わない（width:100% / aspect-ratio の影響を避ける） */}
              <div className="w-[140px] shrink-0 overflow-hidden rounded-md bg-[#f5f5f5] sm:w-[160px]">
                <Image
                  src={imageUrl}
                  alt={work.title}
                  width={160}
                  height={220}
                  className="h-auto w-full object-contain"
                  sizes="(max-width: 640px) 140px, 160px"
                  unoptimized
                />
              </div>
              <div className="min-w-0 w-full flex-1 text-center sm:text-left">
                <h2 className="break-words text-base font-bold leading-snug text-foreground sm:text-lg">
                  {work.title}
                </h2>
                {hasCircle ? (
                  <div className="mt-2 break-words text-sm text-muted">
                    <span className="mr-1">サークル:</span>
                    <DoujinCircleLinks
                      circleIds={work.circleIds}
                      circleNames={work.circleNames}
                      circleId={work.circleId}
                      circleName={work.circleName}
                      variant="link"
                      separator="、"
                    />
                  </div>
                ) : null}
                {price ? (
                  <p className="mt-2 text-lg font-bold text-price">{price}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted">価格情報なし</p>
                )}
                <FanzaButtonBlock
                  hasAffiliate={hasAffiliate}
                  href={fanzaGoHref}
                  align="start"
                  maxWidthClass="max-w-none sm:max-w-[420px]"
                />
              </div>
            </div>
          </section>

          <ol className="mt-10 space-y-6 sm:space-y-8">
            <DoujinGuideStep
              stepNumber={1}
              stepName="open_work"
              workId={work.id}
              className={STEP_CARD_CLASS}
            >
              <p className="text-xs font-semibold tracking-wide text-accent">
                STEP 1
              </p>
              <h3 className="mt-1 text-lg font-bold text-foreground">
                作品ページを開く
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                「この作品を見る」を押すと、FANZAの作品ページが別タブで開きます。
                <br />
                このガイドページは閉じずに、FANZAの画面と見比べながら進めてください。
              </p>
            </DoujinGuideStep>

            <DoujinGuideStep
              stepNumber={2}
              stepName="create_or_login_account"
              workId={work.id}
              className={STEP_CARD_CLASS}
            >
              <p className="text-xs font-semibold tracking-wide text-accent">
                STEP 2
              </p>
              <h3 className="mt-1 text-lg font-bold text-foreground">
                DMMアカウントを作成またはログインする
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                FANZAを初めて利用する場合は、無料のDMMアカウントを作成します。月額サービスへの登録ではなく、作品を購入するための無料アカウント作成です。
              </p>

              <h4 className="mt-5 text-base font-bold text-foreground">
                DMMアカウントを作成する
              </h4>
              <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-muted">
                <li>
                  <p className="font-medium text-foreground">
                    「この作品を見る」を押す
                  </p>
                  <p className="mt-1">
                    FANZAの作品ページが別タブで開きます。このガイドページは閉じずに、FANZAの画面と見比べながら進めてください。
                  </p>
                </li>
                <li>
                  <p className="font-medium text-foreground">
                    FANZAの画面で「新規会員登録」を選ぶ
                  </p>
                  <p className="mt-1">
                    未ログインの場合は、ログイン画面またはアカウントメニューから「新規会員登録」へ進みます。すでにDMMアカウントを持っている場合は、新しく登録せず、そのアカウントでログインします。
                  </p>
                </li>
                <li>
                  <p className="font-medium text-foreground">
                    メールアドレスとパスワードを設定する
                  </p>
                  <p className="mt-1">
                    画面の案内に沿って、利用するメールアドレスとパスワードを入力します。Google、LINEなど、FANZA側に外部アカウント登録が表示される場合は、その方法を利用しても構いません。実際に表示される登録方法はFANZA側の最新画面を優先してください。
                  </p>
                </li>
                <li>
                  <p className="font-medium text-foreground">
                    届いたメールを確認する
                  </p>
                  <p className="mt-1">
                    メールアドレスで登録した場合は、DMMから届く認証メールを開き、案内されたリンクを押して登録を完了します。メールが届かない場合は、迷惑メールフォルダ・入力したメールアドレス・受信拒否設定を確認してください。
                  </p>
                </li>
                <li>
                  <p className="font-medium text-foreground">
                    FANZAへログインする
                  </p>
                  <p className="mt-1">
                    登録したアカウントでログインすると、元の作品の購入手続きへ進めます。
                  </p>
                </li>
              </ol>
            </DoujinGuideStep>

            <DoujinGuideStep
              stepNumber={3}
              stepName="choose_payment"
              workId={work.id}
              className={STEP_CARD_CLASS}
            >
              <p className="text-xs font-semibold tracking-wide text-accent">
                STEP 3
              </p>
              <h3 className="mt-1 text-lg font-bold text-foreground">
                支払い方法を選ぶ
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                FANZAのお支払い方法の選択画面で、利用する支払い方法を選びます。
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {PAYMENT_METHODS.map((method) => (
                  <li
                    key={method.name}
                    className="rounded-md border border-border bg-surface px-3.5 py-3"
                  >
                    <p className="text-sm font-bold text-foreground">
                      {method.name}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      {method.description}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                利用可能な支払い方法は、FANZA側の最新画面をご確認ください。
              </p>
            </DoujinGuideStep>

            <DoujinGuideStep
              stepNumber={4}
              stepName="confirm_purchase"
              workId={work.id}
              className={STEP_CARD_CLASS}
            >
              <p className="text-xs font-semibold tracking-wide text-accent">
                STEP 4
              </p>
              <h3 className="mt-1 text-lg font-bold text-foreground">
                購入内容を確認する
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                作品名・価格・支払い方法に間違いがないかを確認します。
              </p>
            </DoujinGuideStep>

            <DoujinGuideStep
              stepNumber={5}
              stepName="complete_purchase"
              workId={work.id}
              className={STEP_CARD_CLASS}
            >
              <p className="text-xs font-semibold tracking-wide text-accent">
                STEP 5
              </p>
              <h3 className="mt-1 text-lg font-bold text-foreground">
                購入を完了する
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                画面の案内に沿って支払いを進め、購入を完了します。
              </p>
            </DoujinGuideStep>

            <DoujinGuideStep
              stepNumber={6}
              stepName="read_work"
              workId={work.id}
              className={STEP_CARD_CLASS}
            >
              <p className="text-xs font-semibold tracking-wide text-accent">
                STEP 6
              </p>
              <h3 className="mt-1 text-lg font-bold text-foreground">
                購入した作品を読む
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                購入後はブラウザまたはアプリから作品を閲覧できます。
              </p>
            </DoujinGuideStep>
          </ol>

          <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-8">
            <FanzaButtonBlock hasAffiliate={hasAffiliate} href={fanzaGoHref} />
            <p className="text-center text-xs leading-relaxed text-muted">
              ※ FANZAを初めて利用する人向けの購入手順ガイドです。別タブでFANZAが開きます。
            </p>
          </div>
        </article>
      </DoujinFirstPurchaseGuideTracker>
    </DoujinPageLayout>
  );
}
