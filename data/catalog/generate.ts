import type {
  Actress,
  Genre,
  Label,
  Maker,
  RelatedArticle,
  Series,
  Work,
} from "../types";

const GENRE_NAMES = [
  "ドラマ",
  "恋愛",
  "人妻",
  "女子大生",
  "制服",
  "OL",
  "ナース",
  "家庭教師",
  "温泉",
  "企画",
  "ドキュメンタリー",
  "コスプレ",
  "新人",
  "熟女",
  "美少女",
  "バラエティ",
  "NTR",
  "素人",
  "ハメ撮り",
  "総集編",
];

const MAKER_NAMES = [
  "S1 NO.1 STYLE",
  "MOODYZ",
  "プレステージ",
  "アイデアポケット",
  "kawaii",
  "Madonna",
  "FALENO",
  "E-BODY",
  "本中",
  "無垢",
  "Attackers",
  "Das!",
  "SODクリエイト",
  "ROOKIE",
  "BeFree",
  "DOC",
  "ナチュラルハイ",
  "Glory Quest",
  "Waap",
  "Hunter",
];

const LABEL_DATA: { name: string; makerIndex: number }[] = [
  { name: "S1 NO.1 STYLE", makerIndex: 0 },
  { name: "MOODYZ", makerIndex: 1 },
  { name: "ABSOLUTELY PERFECT", makerIndex: 2 },
  { name: "アイデアポケット", makerIndex: 3 },
  { name: "kawaii", makerIndex: 4 },
  { name: "Madonna", makerIndex: 5 },
  { name: "FALENO", makerIndex: 6 },
  { name: "E-BODY", makerIndex: 7 },
  { name: "本中", makerIndex: 8 },
  { name: "無垢", makerIndex: 9 },
  { name: "Attackers", makerIndex: 10 },
  { name: "Das!", makerIndex: 11 },
  { name: "SODクリエイト", makerIndex: 12 },
  { name: "ROOKIE", makerIndex: 13 },
  { name: "BeFree", makerIndex: 14 },
  { name: "DOC", makerIndex: 15 },
  { name: "ナチュラルハイ", makerIndex: 16 },
  { name: "Glory Quest", makerIndex: 17 },
  { name: "Waap Entertainment", makerIndex: 18 },
  { name: "Hunter", makerIndex: 19 },
];

const SERIES_DATA: {
  name: string;
  makerIndex: number;
  genreIndices: number[];
}[] = [
  { name: "秘密の関係", makerIndex: 0, genreIndices: [0, 1] },
  { name: "週末ラブストーリー", makerIndex: 0, genreIndices: [1, 0] },
  { name: "人妻の誘惑", makerIndex: 5, genreIndices: [2, 0] },
  { name: "OLの裏側", makerIndex: 1, genreIndices: [5, 0] },
  { name: "制服コレクション", makerIndex: 3, genreIndices: [4, 14] },
  { name: "コスプレ天国", makerIndex: 4, genreIndices: [11, 14] },
  { name: "素人ナンパ", makerIndex: 15, genreIndices: [17, 9] },
  { name: "マッサージサロン", makerIndex: 2, genreIndices: [8, 9] },
  { name: "寝取られ劇場", makerIndex: 10, genreIndices: [16, 0] },
  { name: "熟女の花園", makerIndex: 5, genreIndices: [13, 0] },
  { name: "新人デビュー", makerIndex: 13, genreIndices: [12, 10] },
  { name: "ベストセレクション", makerIndex: 0, genreIndices: [19, 15] },
  { name: "スペシャル企画", makerIndex: 16, genreIndices: [9, 15] },
  { name: "夜のドキュメント", makerIndex: 12, genreIndices: [10, 0] },
  { name: "純愛シリーズ", makerIndex: 6, genreIndices: [1, 14] },
  { name: "禁断の恋", makerIndex: 1, genreIndices: [1, 16] },
  { name: "ハメ撮り日記", makerIndex: 15, genreIndices: [18, 17] },
  { name: "総集編スペシャル", makerIndex: 0, genreIndices: [19, 15] },
  { name: "女子大生の放課後", makerIndex: 3, genreIndices: [3, 4] },
  { name: "ナース物語", makerIndex: 7, genreIndices: [6, 0] },
  { name: "家庭教師シリーズ", makerIndex: 2, genreIndices: [7, 4] },
  { name: "温泉旅行", makerIndex: 8, genreIndices: [8, 1] },
  { name: "美少女図鑑", makerIndex: 4, genreIndices: [14, 1] },
  { name: "初体験ドキュメント", makerIndex: 13, genreIndices: [12, 10] },
  { name: "人妻不倫劇場", makerIndex: 5, genreIndices: [2, 16] },
  { name: "SOD企画バラエティ", makerIndex: 12, genreIndices: [15, 9] },
  { name: "E-BODYスペシャル", makerIndex: 7, genreIndices: [14, 0] },
  { name: "本番中出しシリーズ", makerIndex: 8, genreIndices: [0, 1] },
  { name: "無垢デビュー", makerIndex: 9, genreIndices: [12, 14] },
  { name: "Attackersドラマ", makerIndex: 10, genreIndices: [0, 16] },
];

const ACTRESS_DATA: {
  name: string;
  debutYear: number;
  specialtyGenres: number[];
}[] = [
  { name: "波多野結衣", debutYear: 2008, specialtyGenres: [0, 2, 13] },
  { name: "三上悠亜", debutYear: 2015, specialtyGenres: [14, 1, 11] },
  { name: "上原亜衣", debutYear: 2012, specialtyGenres: [0, 5, 13] },
  { name: "君島みお", debutYear: 2013, specialtyGenres: [2, 13, 0] },
  { name: "つかさ", debutYear: 2014, specialtyGenres: [14, 1, 4] },
  { name: "西川ゆい", debutYear: 2016, specialtyGenres: [3, 4, 14] },
  { name: "明日花キララ", debutYear: 2007, specialtyGenres: [14, 11, 15] },
  { name: "天使もえ", debutYear: 2015, specialtyGenres: [14, 1, 0] },
  { name: "橋本ありな", debutYear: 2016, specialtyGenres: [14, 4, 1] },
  { name: "深田えいみ", debutYear: 2017, specialtyGenres: [14, 0, 5] },
  { name: "葵つかさ", debutYear: 2018, specialtyGenres: [14, 1, 3] },
  { name: "小野夕子", debutYear: 2014, specialtyGenres: [2, 13, 0] },
  { name: "JULIA", debutYear: 2010, specialtyGenres: [13, 7, 0] },
  { name: "水野朝阳", debutYear: 2013, specialtyGenres: [13, 2, 0] },
  { name: "AIKA", debutYear: 2011, specialtyGenres: [13, 5, 15] },
  { name: "大槻ひびき", debutYear: 2012, specialtyGenres: [13, 0, 2] },
  { name: "篠田ゆう", debutYear: 2014, specialtyGenres: [2, 13, 0] },
  { name: "美谷朱音", debutYear: 2019, specialtyGenres: [14, 1, 4] },
  { name: "佐山愛", debutYear: 2009, specialtyGenres: [13, 2, 8] },
  { name: "藤森里穂", debutYear: 2017, specialtyGenres: [14, 0, 1] },
  { name: "松本いちか", debutYear: 2018, specialtyGenres: [14, 3, 4] },
  { name: "希島あいり", debutYear: 2013, specialtyGenres: [14, 1, 11] },
  { name: "桃乃木かな", debutYear: 2015, specialtyGenres: [14, 1, 4] },
  { name: "楪カレン", debutYear: 2018, specialtyGenres: [14, 12, 1] },
  { name: "河北彩花", debutYear: 2021, specialtyGenres: [14, 1, 12] },
  { name: "miru", debutYear: 2016, specialtyGenres: [14, 0, 5] },
  { name: "石川澪", debutYear: 2022, specialtyGenres: [14, 12, 1] },
  { name: "七沢みあ", debutYear: 2017, specialtyGenres: [14, 4, 1] },
  { name: "小宵こなん", debutYear: 2019, specialtyGenres: [14, 1, 0] },
  { name: "山岸逢花", debutYear: 2017, specialtyGenres: [0, 1, 2] },
];

const WORK_TITLE_TEMPLATES = [
  "{actress} {series} 完全版",
  "{series} {actress} SPECIAL",
  "【{genre}】{actress}の{series}",
  "{actress} {genre} BEST",
  "{series} Vol.{vol} {actress}",
  "{actress}と過ごす{genre}な一日",
  "初めての{genre} {actress}",
  "{series} {genre}編 {actress}",
  "{actress} {maker} スペシャル",
  "禁断の{genre} {actress}",
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function padNum(n: number, len = 3): string {
  return String(n).padStart(len, "0");
}

function distributeCounts(total: number, buckets: number, weights?: number[]): number[] {
  const w = weights ?? Array.from({ length: buckets }, (_, i) => buckets - i);
  const sum = w.reduce((a, b) => a + b, 0);
  const counts = w.map((weight) => Math.max(1, Math.round((weight / sum) * total)));
  let diff = total - counts.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (diff !== 0) {
    if (diff > 0) {
      counts[idx % buckets]++;
      diff--;
    } else if (counts[idx % buckets] > 1) {
      counts[idx % buckets]--;
      diff++;
    }
    idx++;
  }
  return counts;
}

function buildAssignments(
  total: number,
  bucketCount: number,
  weights?: number[],
): number[][] {
  const counts = distributeCounts(total, bucketCount, weights);
  const assignments: number[][] = Array.from({ length: bucketCount }, () => []);
  let workIdx = 0;
  for (let b = 0; b < bucketCount; b++) {
    for (let c = 0; c < counts[b] && workIdx < total; c++) {
      assignments[b].push(workIdx);
      workIdx++;
    }
  }
  while (workIdx < total) {
    assignments[workIdx % bucketCount].push(workIdx);
    workIdx++;
  }
  return assignments;
}

function genreLongDescription(name: string): string {
  return `${name}ジャンルは、アダルト図鑑で人気のカテゴリのひとつです。${name}系の作品は、視聴者の好みに合わせた幅広いラインナップが魅力で、初心者からベテランまで楽しめる作品が揃っています。当サイトでは、${name}ジャンルの作品を人気順・新着順・セール情報とあわせて一覧表示しています。メーカーや出演女優、シリーズ名、レーベルからも関連作品をたどれるため、お気に入りの一本を見つけやすい構成です。${name}ジャンルの特徴やおすすめの探し方を解説し、あなたにぴったりの作品選びをサポートします。`;
}

function makerLongDescription(name: string): string {
  return `${name}は、アダルト業界で高い知名度を持つメーカーです。独自の作風と企画力により、多くの人気作品をリリースしています。アダルト図鑑では、${name}の作品をジャンル別・女優別・シリーズ別・レーベル別に整理し、比較しやすい形で掲載しています。新作やセール情報も随時更新されるため、お得なタイミングで作品を見つけることができます。人気シリーズや専属女優の出演作も充実しており、ブランドの世界観を楽しみながら作品選びが可能です。`;
}

function labelLongDescription(name: string, makerName: string): string {
  return `「${name}」は、${makerName}が展開するレーベルです。ブランドならではの企画力とクオリティで、多くのファンから支持を集めています。アダルト図鑑では、${name}レーベルの作品を一覧で確認でき、出演女優やシリーズ、ジャンル情報も合わせて比較できます。`;
}

function seriesLongDescription(name: string, makerName: string): string {
  return `「${name}」シリーズは、${makerName}より配信される人気作品群です。シリーズならではの世界観と継続的な企画力が支持されています。アダルト図鑑では、${name}シリーズに属する作品を一覧で確認でき、出演女優やメーカー、ジャンル、レーベル情報も合わせて比較できます。`;
}

function actressProfile(
  name: string,
  debutYear: number,
  genres: string[],
): string {
  const genreText = genres.slice(0, 3).join("・");
  return `${name}は${debutYear}年にデビューし、${genreText}など幅広いジャンルで活躍する人気女優です。繊細な演技力と高い表現力で、多くの作品で高い評価を獲得しています。アダルト図鑑では、${name}さんの出演作品を品番・メーカー・ジャンル・シリーズ別に整理しています。人気順や新着順での一覧表示、関連女優やシリーズからの作品探しにも対応。デビュー作から最新作まで、${name}さんのフィルモグラフィーを体系的にたどることができます。`;
}

function workLongDescription(
  title: string,
  actressNames: string[],
  makerName: string,
  seriesName: string,
  genreNames: string[],
): string {
  const cast = actressNames.join("・");
  const genres = genreNames.join("・");
  return `「${title}」は、${makerName}より配信される${seriesName}シリーズの一作です。${cast}が出演する${genres}ジャンルの作品で、シリーズ特有の世界観と高いクオリティが魅力です。ストーリー展開や演出にこだわった本作は、${genres}系作品ファンから高い支持を集めています。品番・収録時間・配信価格は詳細ページでご確認いただけます。購入・視聴はFANZA等の公式配信サイトにて行ってください。`;
}

function workRecommendPoints(
  genreNames: string[],
  seriesName: string,
  actressNames: string[],
): string[] {
  return [
    `${actressNames[0]}の演技力が光る${genreNames[0]}系作品`,
    `人気シリーズ「${seriesName}」の世界観を楽しめる`,
    `${genreNames.join("・")}ジャンルの要素が詰まった一本`,
    actressNames.length > 1
      ? `${actressNames[1]}との共演も見どころ`
      : "高画質配信に対応したクオリティ",
  ];
}

export function generateGenres(): Genre[] {
  return GENRE_NAMES.map((name) => ({
    slug: slugify(name),
    name,
    description: `${name}ジャンルの作品一覧。`,
    longDescription: genreLongDescription(name),
  }));
}

export function generateMakers(labels: Label[]): Maker[] {
  return MAKER_NAMES.map((name) => ({
    slug: slugify(name),
    name,
    description: `${name}の作品一覧。`,
    longDescription: makerLongDescription(name),
    labelSlugs: labels
      .filter((label) => label.makerSlug === slugify(name))
      .map((label) => label.slug),
  }));
}

export function generateLabels(): Label[] {
  return LABEL_DATA.map(({ name, makerIndex }) => {
    const makerName = MAKER_NAMES[makerIndex];
    const makerSlug = slugify(makerName);
    return {
      slug: slugify(name),
      name,
      makerSlug,
      makerName,
      description: `${name}レーベルの作品一覧。`,
      longDescription: labelLongDescription(name, makerName),
    };
  });
}

export function generateSeries(genres: Genre[]): Series[] {
  return SERIES_DATA.map(({ name, makerIndex, genreIndices }) => {
    const makerName = MAKER_NAMES[makerIndex];
    return {
      slug: slugify(name),
      name,
      description: `${name}シリーズの作品一覧。`,
      longDescription: seriesLongDescription(name, makerName),
      makerSlug: slugify(makerName),
      makerName,
      genreSlugs: genreIndices.map((i) => genres[i].slug),
    };
  });
}

function buildRelatedArticles(
  actressIndex: number,
  genres: Genre[],
  seriesList: Series[],
): RelatedArticle[] {
  const data = ACTRESS_DATA[actressIndex];
  const articles: RelatedArticle[] = [];

  for (const gi of data.specialtyGenres.slice(0, 2)) {
    const genre = genres[gi];
    articles.push({
      title: `${genre.name}ジャンルのおすすめ作品`,
      href: `/genres/${genre.slug}`,
      description: `${genre.name}系作品を人気順でチェック`,
    });
  }

  const series = seriesList[actressIndex % seriesList.length];
  articles.push({
    title: `「${series.name}」シリーズ特集`,
    href: `/series/${series.slug}`,
    description: `${series.name}シリーズの全作品一覧`,
  });

  return articles;
}

function buildRelatedActresses(actressIndex: number, actresses: Actress[]): string[] {
  const related: string[] = [];
  const offsets = [1, 3, 7, 11];
  for (const offset of offsets) {
    const idx = (actressIndex + offset) % actresses.length;
    if (idx !== actressIndex) {
      related.push(actresses[idx].slug);
    }
  }
  return related.slice(0, 4);
}

export function generateActresses(genres: Genre[], seriesList: Series[]): Actress[] {
  return ACTRESS_DATA.map((data, index) => {
    const specialtyNames = data.specialtyGenres.map((i) => genres[i].name);
    const actress: Actress = {
      slug: slugify(data.name),
      name: data.name,
      description: `${data.name}の出演作品一覧。`,
      profile: actressProfile(data.name, data.debutYear, specialtyNames),
      debutYear: data.debutYear,
      imageUrl: "",
      rankingScore: 1000 - index * 8 + (index % 5) * 3,
      representativeSeriesSlugs: [
        seriesList[index % seriesList.length].slug,
        seriesList[(index + 3) % seriesList.length].slug,
      ],
      relatedActressSlugs: [],
      relatedArticles: buildRelatedArticles(index, genres, seriesList),
    };
    return actress;
  }).map((actress, index, all) => ({
    ...actress,
    relatedActressSlugs: buildRelatedActresses(index, all),
  }));
}

export function generateWorks(
  genres: Genre[],
  makers: Maker[],
  labels: Label[],
  seriesList: Series[],
  actresses: Actress[],
): Work[] {
  const total = 100;
  const actressAssignments = buildAssignments(total, 30);
  const makerAssignments = buildAssignments(
    total,
    20,
    [12, 10, 9, 8, 7, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 2],
  );
  const seriesAssignments = buildAssignments(total, 30);

  const workActresses: number[][] = Array.from({ length: total }, () => []);
  const workMakers: number[] = Array(total).fill(0);
  const workSeries: number[] = Array(total).fill(0);

  for (let a = 0; a < 30; a++) {
    for (const wi of actressAssignments[a]) {
      if (!workActresses[wi].includes(a)) {
        workActresses[wi].push(a);
      }
    }
  }

  for (let m = 0; m < 20; m++) {
    for (const wi of makerAssignments[m]) {
      workMakers[wi] = m;
    }
  }

  for (let s = 0; s < 30; s++) {
    for (const wi of seriesAssignments[s]) {
      workSeries[wi] = s;
    }
  }

  for (let i = 0; i < total; i++) {
    if (workActresses[i].length === 0) {
      workActresses[i].push(i % 30);
    }
    if (i % 3 === 0 && workActresses[i].length === 1) {
      const second = (workActresses[i][0] + 5) % 30;
      if (second !== workActresses[i][0]) {
        workActresses[i].push(second);
      }
    }
  }

  const works: Work[] = [];

  for (let i = 0; i < total; i++) {
    const idx = i;
    const makerIndex = workMakers[i];
    const seriesIndex = workSeries[i];
    const maker = makers[makerIndex];
    const series = seriesList[seriesIndex];
    const label = labels.find((l) => l.makerSlug === maker.slug) ?? labels[makerIndex];
    const primaryActressIndex = workActresses[i][0];
    const actressData = ACTRESS_DATA[primaryActressIndex];

    const genreIndices = [
      series.genreSlugs[0]
        ? genres.findIndex((g) => g.slug === series.genreSlugs[0])
        : actressData.specialtyGenres[0],
      actressData.specialtyGenres[0],
    ].filter((gi, pos, arr) => gi >= 0 && arr.indexOf(gi) === pos);

    if (genreIndices.length < 2) {
      genreIndices.push(actressData.specialtyGenres[1] ?? 0);
    }

    const genre1 = genres[genreIndices[0] ?? 0];
    const genre2 = genres[genreIndices[1] ?? 1] ?? genre1;
    const actressSlugs = workActresses[i].map((ai) => actresses[ai].slug);
    const actressNames = workActresses[i].map((ai) => actresses[ai].name);

    const vol = Math.floor(i / 5) + 1;
    const template =
      WORK_TITLE_TEMPLATES[idx % WORK_TITLE_TEMPLATES.length];
    const title = template
      .replace("{actress}", actressNames[0])
      .replace("{series}", series.name)
      .replace("{genre}", genre1.name)
      .replace("{maker}", maker.name)
      .replace("{vol}", String(vol));

    const productCode = `AZ-2026-${padNum(i + 1, 4)}`;
    const slug = `work-${padNum(i + 1)}`;
    const basePrice = 1980 + (idx % 12) * 100;
    const hasSale = idx % 4 === 0;
    const month = ((idx % 12) + 1).toString().padStart(2, "0");
    const day = ((idx % 28) + 1).toString().padStart(2, "0");
    const releaseDate = `2025-${month}-${day}`;
    const daysSinceRelease = (12 - (idx % 12)) * 7;
    const rankingScore = 1000 - idx * 3 + (idx % 7) * 5;
    const weeklyScore = rankingScore + Math.max(0, 50 - daysSinceRelease);
    const monthlyScore = rankingScore + Math.max(0, 30 - Math.floor(daysSinceRelease / 2));

    works.push({
      slug,
      contentId: productCode,
      productId: productCode,
      title,
      description: `${maker.name}より配信。${genre1.name}・${genre2.name}ジャンルの${series.name}シリーズ作品。${actressNames.join("・")}出演。`,
      longDescription: workLongDescription(
        title,
        actressNames,
        maker.name,
        series.name,
        [genre1.name, genre2.name],
      ),
      recommendPoints: workRecommendPoints(
        [genre1.name, genre2.name],
        series.name,
        actressNames,
      ),
      productCode,
      releaseDate,
      price: basePrice,
      salePrice: hasSale ? Math.floor(basePrice * 0.65) : undefined,
      duration: 110 + (idx % 8) * 10,
      makerSlug: maker.slug,
      makerName: maker.name,
      labelSlug: label.slug,
      labelName: label.name,
      seriesSlug: series.slug,
      seriesName: series.name,
      genreSlugs: [genre1.slug, genre2.slug],
      genreNames: [genre1.name, genre2.name],
      actressSlugs,
      actressNames,
      relatedWorkSlugs: [],
      imageUrl: "",
      affiliateUrl: `https://example.com/affiliate/${productCode}`,
      affiliateProvider: "fanza",
      rankingScore,
      weeklyScore,
      monthlyScore,
      source: "fallback",
    });
  }

  for (const work of works) {
    work.relatedWorkSlugs = works
      .filter(
        (item) =>
          item.slug !== work.slug &&
          (item.seriesSlug === work.seriesSlug ||
            item.makerSlug === work.makerSlug ||
            item.actressSlugs.some((s) => work.actressSlugs.includes(s)) ||
            item.genreSlugs.some((s) => work.genreSlugs.includes(s))),
      )
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, 4)
      .map((item) => item.slug);
  }

  return works;
}

export function generateCatalog() {
  const genres = generateGenres();
  const labels = generateLabels();
  const makers = generateMakers(labels);
  const series = generateSeries(genres);
  const actresses = generateActresses(genres, series);
  const works = generateWorks(genres, makers, labels, series, actresses);

  return { genres, makers, labels, series, actresses, works };
}
