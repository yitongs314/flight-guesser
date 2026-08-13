import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ClueOffer } from './types';

export type Lang = 'en' | 'zh';

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    'header.flight': 'Flight',
    'header.score': 'Score',
    'home.tagline1': 'A real flight is in the air right now. Spend points on clues and work out ',
    'home.tagline2': "what you can't see",
    'home.tagline3': '.',
    'home.pickMode': 'Pick a mode',
    'mode.route.title': 'Guess the route',
    'mode.route.desc': 'Find both the departure and arrival airports.',
    'mode.departure.title': 'Guess the departure',
    'mode.departure.desc': 'Find where it took off — arrival clues are on sale.',
    'mode.arrival.title': 'Guess the arrival',
    'mode.arrival.desc': "Find where it's headed — departure clues are on sale.",
    'mode.airline.title': 'Guess the airline',
    'mode.airline.desc': 'Whose metal is it? Airport clues are buyable; the operator stays hidden.',
    'mode.type.title': 'Guess the aircraft',
    'mode.type.desc': 'Nail the exact variant. Family guesses get a nudge.',
    'mode.photo.title': 'Guess from the photo',
    'mode.photo.desc': 'A masked photo — click tiles to reveal them. Name both the airline and the aircraft.',
    'mode.fill.title': 'Fill the flight',
    'mode.fill.desc': 'One fact is given free. Deduce the other three from distance and match feedback.',
    'home.scoring': 'Scoring',
    'scoring.decay': 'Points shop',
    'scoring.decay.tip': 'Start each flight with 1,000 pts. Clues cost their listed price; wrong guesses −50.',
    'scoring.strikes': '3 strikes',
    'scoring.strikes.tip': 'Clues still cost points, and three wrong guesses ends the flight at 0.',
    'scoring.race': 'First wins',
    'scoring.race.tip':
      'Two-player only: the first correct answer takes the flight, the other side scores 0.',
    'room.section': 'Two-player',
    'room.create': 'Create room',
    'room.join': 'Join',
    'room.codePh': 'ROOM CODE',
    'room.hint': 'Create a room with the settings above, then share the code. The match starts when your opponent joins.',
    'room.lobby': 'Room code',
    'room.share': 'Share this code with your opponent.',
    'room.waiting': 'Waiting for an opponent to join…',
    'room.cancel': 'Leave room',
    'room.opp': 'Opponent',
    'room.you': 'You',
    'room.oppPlaying': 'still playing…',
    'room.oppDone': 'done',
    'room.bought': '{n} clues bought',
    'room.wrong': '{n} wrong',
    'room.flightN': 'flight {n}',
    'room.waitOpp': 'Your opponent is still on this flight — the next one starts when you are both ready.',
    'room.ready': 'Ready — next flight',
    'room.readyWaiting': 'Ready ✓ waiting for opponent…',
    'room.final': 'See final result',
    'room.win': 'You win!',
    'room.lose': 'Opponent wins',
    'room.draw': 'Draw',
    'error.ROOM_NOT_FOUND': 'Room not found or expired.',
    'error.ROOM_FULL': 'That room is already full.',
    'home.spotlight': 'Now in the sky',
    'home.spotlightAgain': 'Another one',
    'home.spotlightBusy': 'Scanning the skies…',
    'daily.title': 'Daily flight',
    'daily.play': 'Play',
    'daily.played': 'Done',
    'daily.board': 'Leaderboard',
    'daily.namePh': 'Your name',
    'daily.players': '{n} played',
    'daily.share': 'Copy result',
    'daily.shared': 'Copied!',
    'daily.empty': 'No attempts yet today.',
    'daily.close': 'Close',
    'stats.line': 'Played {played} · solved {solved} · avg {avg} pts',
    'home.flights': 'Flights',
    'home.start': 'Find me a flight',
    'home.loading': 'Loading datasets…',
    'busy.find': 'Scanning the skies for a flight…',
    'busy.next': 'Scanning the skies for the next flight…',
    'error.datasets': "Couldn't load datasets — is the API server running?",
    'error.NO_FLIGHT': 'No suitable live flight found right now — try again in a minute.',
    'error.NO_PHOTO_FLIGHT': 'Could not find a live flight with a usable photo — try again in a minute.',
    'error.NO_PHOTO_CONTACT': 'Photo mode needs PHOTO_CONTACT set in server/.env.',
    'error.CANT_AFFORD': 'Not enough points left to buy this.',
    'game.clueShop': 'Clue shop',
    'game.clueHelp': 'Buy any clue at its listed price — cheap clues are vague, pricey ones are damning.',
    'game.photoHunt': 'Photo hunt',
    'game.howItWorks': 'How it works',
    'game.photoHelp':
      'A real photo of the aircraft hides under the tiles. Your first tile is free; after that each costs {price} pts. Name both the airline and the exact type — each locks in green.',
    'game.giveUp': 'Give up',
    'game.solve.pre': 'Solve now for ',
    'game.solve.post': ' pts',
    'game.tiles': '{revealed} / {total} tiles revealed',
    'game.strikes': 'strikes',
    'game.mapPlaceholder': 'The map lights up when you buy a position clue.',
    'fb.clue': 'after {n} clues',
    'fb.tile': 'after {n} tiles',
    'fb.kmOff': '{km} km off',
    'fb.family': 'right family!',
    'fb.mfrMatch': 'right manufacturer',
    'fb.countryMatch': 'right country',
    'fb.allianceMatch': 'right alliance',
    'guess.dep': 'Departure airport…',
    'guess.depQ': 'Which airport did it leave from?',
    'guess.arr': 'Arrival airport…',
    'guess.arrQ': 'Where is it heading?',
    'guess.airline': 'Which airline?',
    'guess.type': 'Which aircraft type?',
    'guess.submit': 'Guess',
    'reveal.solved': 'Solved! +{pts} pts',
    'reveal.failed': 'Not this time — 0 pts',
    'reveal.photoBy': 'Photo ©',
    'reveal.flight': 'Callsign',
    'reveal.airline': 'Airline',
    'reveal.aircraft': 'Aircraft',
    'reveal.registration': 'Registration',
    'reveal.route': 'Route',
    'reveal.distance': 'Distance',
    'reveal.progress': 'Progress',
    'reveal.km': '{km} km',
    'reveal.flown': '{pct}% flown',
    'reveal.mapNote': 'The ✈ marker is where the aircraft is right now; the dashed line is the full route.',
    'reveal.morePhotos': 'More photos of {reg}:',
    'reveal.next': 'Next flight →',
    'reveal.final': 'See final score',
    'summary.title': 'Final score',
    'summary.playAgain': 'Play again',
    'label.family': 'Aircraft family',
    'label.altitude': 'Altitude',
    'label.speedHeading': 'Speed & heading',
    'label.size': 'Aircraft size',
    'label.routeLength': 'Route length',
    'label.progress': 'Progress',
    'label.coarseMap': 'Approximate position',
    'label.fineMap': 'Exact position',
    'label.airlineCountry': 'Airline country',
    'label.airlineName': 'Airline',
    'label.variant': 'Exact type',
    'label.manufacturer': 'Manufacturer',
    'label.originCountry': 'Departure country',
    'label.originAirport': 'Departure airport',
    'label.destCountry': 'Arrival country',
    'label.destAirport': 'Arrival airport',
    'clue.family': 'The aircraft belongs to the {family} family.',
    'clue.altitude.cruise': 'The aircraft is cruising at {alt} ft.',
    'clue.altitude.climb': 'The aircraft is climbing through {alt} ft.',
    'clue.altitude.descend': 'The aircraft is descending through {alt} ft.',
    'clue.speedHeading': 'Ground speed is {gs} kt, tracking {dir}.',
    'clue.size': "It's a {cls}.",
    'clue.routeLength': 'A {bucket} flight: the full route is about {km} km.',
    'clue.progress': 'About {pct}% of the route distance is behind it.',
    'clue.coarseMap': 'Its approximate position (rounded to a wide grid) is shown on the map.',
    'clue.fineMap': 'Its exact position and heading are shown on the map.',
    'clue.airlineCountry': 'The operating airline is based in {country}.',
    'clue.airlineName': 'Operated by {airline}.',
    'clue.variant': 'The exact type is a {type}.',
    'clue.manufacturer': 'The aircraft is built by {manufacturer}.',
    'clue.originCountry': 'It departed from {country}.',
    'clue.originAirport': 'It departed from {airport} ({iata}){citySuffix}.',
    'clue.destCountry': "It's heading to {country}.",
    'clue.destAirport': 'Destination: {airport} ({iata}){citySuffix}.',
    'bucket.short': 'short-haul',
    'bucket.medium': 'medium-haul',
    'bucket.long': 'long-haul',
    'class.narrow-body jet': 'narrow-body jet',
    'class.wide-body jet': 'wide-body jet',
    'class.regional jet': 'regional jet',
    'class.turboprop': 'turboprop',
    'label.airlineHint': 'Airline intel',
    'hint.callsign': 'Its radio callsign is “{value}”.',
    'hint.alliance': "It's a member of {value}.",
    'hint.allianceNone': "It doesn't belong to any global alliance.",
    'hint.nameStarts': 'Its name starts with “{value}”.',
    'hint.nameLetters': 'Its name has {value} letters.',
    'hint.iataStarts': 'Its IATA code starts with “{value}”.',
    'hint.nameWords': 'Its name is {value} word(s) long.',
    'hint.hasAir': 'The word “Air” appears in its name.',
    'hint.noAir': 'The word “Air” does not appear in its name.',
    'alliance.star': 'Star Alliance',
    'alliance.oneworld': 'oneworld',
    'alliance.skyteam': 'SkyTeam',
  },
  zh: {
    'header.flight': '航班',
    'header.score': '得分',
    'home.tagline1': '此刻，真的有一架航班正在天上飞。用分数购买线索，猜出',
    'home.tagline2': '你看不到的信息',
    'home.tagline3': '。',
    'home.pickMode': '选择模式',
    'mode.route.title': '猜航线',
    'mode.route.desc': '找出出发和到达机场。',
    'mode.departure.title': '猜出发地',
    'mode.departure.desc': '它从哪里起飞？到达地的线索可以购买。',
    'mode.arrival.title': '猜目的地',
    'mode.arrival.desc': '它飞往哪里？出发地的线索可以购买。',
    'mode.airline.title': '猜航空公司',
    'mode.airline.desc': '这是谁家的飞机？机场线索可以购买，承运人保密。',
    'mode.type.title': '猜机型',
    'mode.type.desc': '猜出精确型号，猜对系列会有提示。',
    'mode.photo.title': '看图猜飞机',
    'mode.photo.desc': '一张被遮住的照片——点击拼图块揭开。说出航空公司和机型。',
    'mode.fill.title': '补全航班',
    'mode.fill.desc': '免费告诉你一项信息，其余三项靠偏差与匹配反馈推理出来。',
    'home.scoring': '计分方式',
    'scoring.decay': '积分商店',
    'scoring.decay.tip': '每架航班从 1,000 分开始。线索按标价扣分，猜错一次 −50 分。',
    'scoring.strikes': '三振出局',
    'scoring.strikes.tip': '线索照常扣分，猜错三次本架航班计 0 分。',
    'scoring.race': '先猜先赢',
    'scoring.race.tip': '仅限两人对战：先猜对的人赢下本架航班，对方计 0 分。',
    'room.section': '两人对战',
    'room.create': '创建房间',
    'room.join': '加入',
    'room.codePh': '房间码',
    'room.hint': '用上面选好的设置创建房间，把房间码发给对手，对手加入后比赛自动开始。',
    'room.lobby': '房间码',
    'room.share': '把这个房间码发给你的对手。',
    'room.waiting': '等待对手加入…',
    'room.cancel': '离开房间',
    'room.opp': '对手',
    'room.you': '你',
    'room.oppPlaying': '进行中…',
    'room.oppDone': '已完成',
    'room.bought': '已购{n}条线索',
    'room.wrong': '猜错{n}次',
    'room.flightN': '第{n}架',
    'room.waitOpp': '对手还在猜这架航班——双方都准备好后进入下一架。',
    'room.ready': '准备好了，下一架',
    'room.readyWaiting': '已准备 ✓ 等待对手…',
    'room.final': '查看对战结果',
    'room.win': '你赢了！',
    'room.lose': '对手获胜',
    'room.draw': '平局',
    'error.ROOM_NOT_FOUND': '房间不存在或已过期。',
    'error.ROOM_FULL': '这个房间已经满了。',
    'home.spotlight': '此刻在天上',
    'home.spotlightAgain': '换一架',
    'home.spotlightBusy': '正在扫描天空…',
    'daily.title': '每日一题',
    'daily.play': '开始',
    'daily.played': '已完成',
    'daily.board': '排行榜',
    'daily.namePh': '昵称',
    'daily.players': '{n} 人已挑战',
    'daily.share': '复制战绩',
    'daily.shared': '已复制！',
    'daily.empty': '今天还没有人挑战。',
    'daily.close': '关闭',
    'stats.line': '已玩 {played} 局 · 解出 {solved} · 平均 {avg} 分',
    'home.flights': '航班数',
    'home.start': '找一架航班',
    'home.loading': '数据加载中…',
    'busy.find': '正在扫描天空，寻找航班…',
    'busy.next': '正在扫描天空，寻找下一架航班…',
    'error.datasets': '数据加载失败——API 服务器在运行吗？',
    'error.NO_FLIGHT': '目前没有找到合适的航班，请过一分钟再试。',
    'error.NO_PHOTO_FLIGHT': '目前没有找到有可用照片的航班，请过一分钟再试。',
    'error.NO_PHOTO_CONTACT': '看图模式需要在 server/.env 中设置 PHOTO_CONTACT。',
    'error.CANT_AFFORD': '剩余分数不够购买这条线索。',
    'game.clueShop': '线索商店',
    'game.clueHelp': '按标价购买任意线索——便宜的线索模糊，贵的线索一锤定音。',
    'game.photoHunt': '看图猜飞机',
    'game.howItWorks': '玩法说明',
    'game.photoHelp':
      '拼图下藏着这架飞机的真实照片。第一块免费，之后每块 {price} 分。说出航空公司和精确机型——猜对即锁定（绿色）。',
    'game.giveUp': '放弃',
    'game.solve.pre': '现在猜对可得 ',
    'game.solve.post': ' 分',
    'game.tiles': '已揭开 {revealed} / {total} 块',
    'game.strikes': '剩余机会',
    'game.mapPlaceholder': '购买位置线索后，地图就会亮起。',
    'fb.clue': '{n} 条线索后',
    'fb.tile': '{n} 块后',
    'fb.kmOff': '偏差 {km} 公里',
    'fb.family': '系列对了！',
    'fb.mfrMatch': '制造商对了',
    'fb.countryMatch': '国家对了',
    'fb.allianceMatch': '联盟对了',
    'guess.dep': '出发机场…',
    'guess.depQ': '它从哪个机场起飞？',
    'guess.arr': '到达机场…',
    'guess.arrQ': '它飞往哪里？',
    'guess.airline': '哪家航空公司？',
    'guess.type': '什么机型？',
    'guess.submit': '猜！',
    'reveal.solved': '猜对了！+{pts} 分',
    'reveal.failed': '差一点——0 分',
    'reveal.photoBy': '照片 ©',
    'reveal.flight': '呼号',
    'reveal.airline': '航空公司',
    'reveal.aircraft': '机型',
    'reveal.registration': '注册号',
    'reveal.route': '航线',
    'reveal.distance': '航程',
    'reveal.progress': '进度',
    'reveal.km': '{km} 公里',
    'reveal.flown': '已飞 {pct}%',
    'reveal.mapNote': '✈ 标记是飞机此刻的实时位置；虚线是完整航线。',
    'reveal.morePhotos': '更多 {reg} 的照片：',
    'reveal.next': '下一架 →',
    'reveal.final': '查看总分',
    'summary.title': '最终得分',
    'summary.playAgain': '再玩一局',
    'label.family': '机型系列',
    'label.altitude': '高度',
    'label.speedHeading': '速度与航向',
    'label.size': '机身类别',
    'label.routeLength': '航线距离',
    'label.progress': '飞行进度',
    'label.coarseMap': '大致位置',
    'label.fineMap': '精确位置',
    'label.airlineCountry': '航司所在国',
    'label.airlineName': '航空公司',
    'label.variant': '精确机型',
    'label.manufacturer': '制造商',
    'label.originCountry': '出发国家',
    'label.originAirport': '出发机场',
    'label.destCountry': '到达国家',
    'label.destAirport': '到达机场',
    'clue.family': '该机属于{family}系列。',
    'clue.altitude.cruise': '飞机正以 {alt} 英尺的高度巡航。',
    'clue.altitude.climb': '飞机正在爬升，通过 {alt} 英尺。',
    'clue.altitude.descend': '飞机正在下降，通过 {alt} 英尺。',
    'clue.speedHeading': '地速 {gs} 节，航向{dir}。',
    'clue.size': '这是一架{cls}。',
    'clue.routeLength': '这是一条{bucket}航线：全程约 {km} 公里。',
    'clue.progress': '已完成约 {pct}% 的航程。',
    'clue.coarseMap': '地图上显示其大致位置（按大网格取整）。',
    'clue.fineMap': '地图上显示其精确位置与航向。',
    'clue.airlineCountry': '承运航空公司来自{country}。',
    'clue.airlineName': '由{airline}运营。',
    'clue.variant': '精确机型为{type}。',
    'clue.manufacturer': '该机由{manufacturer}制造。',
    'clue.originCountry': '它从{country}起飞。',
    'clue.originAirport': '它从{airport}（{iata}）起飞{citySuffix}。',
    'clue.destCountry': '它飞往{country}。',
    'clue.destAirport': '目的地：{airport}（{iata}）{citySuffix}。',
    'bucket.short': '短程',
    'bucket.medium': '中程',
    'bucket.long': '远程',
    'class.narrow-body jet': '窄体客机',
    'class.wide-body jet': '宽体客机',
    'class.regional jet': '支线客机',
    'class.turboprop': '涡桨飞机',
    'label.airlineHint': '航司情报',
    'hint.callsign': '它的无线电呼号是"{value}"。',
    'hint.alliance': '它是{value}的成员。',
    'hint.allianceNone': '它不属于任何全球航空联盟。',
    'hint.nameStarts': '它的名字以"{value}"开头。',
    'hint.nameLetters': '它的名字共有 {value} 个字母。',
    'hint.iataStarts': '它的IATA代码以"{value}"开头。',
    'hint.nameWords': '它的名字由 {value} 个单词组成。',
    'hint.hasAir': '名字中含有"Air"一词。',
    'hint.noAir': '名字中不含"Air"一词。',
    'alliance.star': '星空联盟',
    'alliance.oneworld': '寰宇一家',
    'alliance.skyteam': '天合联盟',
  },
};

const CARDINALS: Record<Lang, string[]> = {
  en: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
  zh: ['北', '东北', '东', '东南', '南', '西南', '西', '西北'],
};

// Chinese conventions for manufacturer names (Boeing 737-800 → 波音737-800).
const ZH_MANUFACTURERS: [string, string][] = [
  ['De Havilland Canada', '德哈维兰加拿大'],
  ['McDonnell Douglas', '麦道'],
  ['Airbus', '空客'],
  ['Boeing', '波音'],
  ['Embraer', '巴航工业'],
  ['Bombardier', '庞巴迪'],
  ['Saab', '萨博'],
  ['Sukhoi', '苏霍伊'],
  ['COMAC', '中国商飞'],
  ['Fokker', '福克'],
  ['Antonov', '安东诺夫'],
];

function localeOf(lang: Lang): string {
  return lang === 'zh' ? 'zh-CN' : 'en-US';
}

function interpolate(template: string, vars: Record<string, string | number>, lang: Lang): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) return '';
    return typeof v === 'number' ? v.toLocaleString(localeOf(lang)) : v;
  });
}

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Localized country name via Intl.DisplayNames; falls back to the English name. */
  countryName: (name: string, code?: string) => string;
  /** Localized aircraft/family name (波音737-800 etc. in Chinese). */
  aircraftName: (name: string) => string;
  clueLabel: (key: string) => string;
  clueText: (clue: ClueOffer) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem('fg-lang');
    if (stored === 'en' || stored === 'zh') return stored;
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('fg-lang', lang);
    document.documentElement.lang = localeOf(lang);
  }, [lang]);

  const value = useMemo<I18n>(() => {
    const t = (key: string, vars: Record<string, string | number> = {}) =>
      interpolate(STRINGS[lang][key] ?? STRINGS.en[key] ?? key, vars, lang);

    let displayNames: Intl.DisplayNames | null = null;
    try {
      displayNames = new Intl.DisplayNames([localeOf(lang)], { type: 'region' });
    } catch {
      displayNames = null;
    }
    const countryName = (name: string, code?: string) => {
      if (lang === 'en' || !code || !displayNames) return name;
      try {
        return displayNames.of(code.toUpperCase()) ?? name;
      } catch {
        return name;
      }
    };

    const aircraftName = (name: string) => {
      if (lang !== 'zh') return name;
      for (const [en, zh] of ZH_MANUFACTURERS) {
        if (name.startsWith(en)) return zh + name.slice(en.length).replace(/^ /, '');
      }
      return name;
    };

    const clueLabel = (key: string) => t(`label.${key}`);

    const clueText = (clue: ClueOffer): string => {
      const p = clue.params ?? {};
      switch (clue.key) {
        case 'family':
          return t('clue.family', { family: aircraftName(String(p.family)) });
        case 'altitude':
          return t(`clue.altitude.${p.phase}`, { alt: Number(p.alt) });
        case 'speedHeading':
          return t('clue.speedHeading', {
            gs: Number(p.gs),
            dir: CARDINALS[lang][Number(p.dir)] ?? '',
          });
        case 'size':
          return t('clue.size', { cls: t(`class.${p.cls}`) });
        case 'routeLength':
          return t('clue.routeLength', { bucket: t(`bucket.${p.bucket}`), km: Number(p.km) });
        case 'progress':
          return t('clue.progress', { pct: Number(p.pct) });
        case 'airlineCountry':
        case 'originCountry':
        case 'destCountry':
          return t(`clue.${clue.key}`, {
            country: countryName(String(p.country), p.code ? String(p.code) : undefined),
          });
        case 'airlineName':
          return t('clue.airlineName', { airline: String(p.airline) });
        case 'variant':
          return t('clue.variant', { type: aircraftName(String(p.type)) });
        case 'manufacturer':
          return t('clue.manufacturer', { manufacturer: aircraftName(String(p.manufacturer)) });
        case 'airlineHint': {
          if (p.tpl) {
            const value = p.tpl === 'alliance' ? t(`alliance.${p.value}`) : p.value;
            return t(`hint.${p.tpl}`, { value: value as string | number });
          }
          return String(p[lang] ?? p.en ?? '');
        }
        case 'originAirport':
        case 'destAirport': {
          const city = p.city ? String(p.city) : '';
          const citySuffix = city ? (lang === 'zh' ? `，位于${city}` : `, ${city}`) : '';
          return t(`clue.${clue.key}`, {
            airport: String(p.airport),
            iata: String(p.iata),
            citySuffix,
          });
        }
        default:
          return t(`clue.${clue.key}`, p as Record<string, string | number>);
      }
    };

    return { lang, setLang, t, countryName, aircraftName, clueLabel, clueText };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider');
  return ctx;
}
