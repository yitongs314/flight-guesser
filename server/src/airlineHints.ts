import type { Airline } from './types';
import { shuffle } from './util';

/**
 * Airline intel hints. Curated pools (10 bilingual hints) exist for the
 * airlines the picker lands on most; every airline additionally gets
 * data-driven template hints, so a game can always offer its hint slots.
 * Hints must never contain the airline's name.
 */
export type Hint = Record<string, string | number>;

const h = (en: string, zh: string): Hint => ({ en, zh });

const CURATED: Record<string, Hint[]> = {
  AAL: [
    h('Its mainline fleet is the largest in the world.', '它拥有全球规模最大的主线机队。'),
    h('Headquartered in Fort Worth, Texas.', '总部位于得克萨斯州沃斯堡。'),
    h('Its largest hub is Dallas/Fort Worth.', '最大枢纽是达拉斯-沃斯堡。'),
    h('A founding member of oneworld.', '寰宇一家创始成员。'),
    h('Launched the first major frequent-flyer program in 1981.', '1981年推出了全球首个大型常旅客计划。'),
    h('Merged with US Airways in 2013.', '2013年与全美航空合并。'),
    h('Its planes flew in bare polished metal for decades.', '其飞机曾数十年使用裸金属抛光涂装。'),
    h('The tail wears stripes echoing the US flag.', '尾翼是美国国旗风格的条纹。'),
    h('Flies premium-heavy A321s coast-to-coast.', '用高端布局的A321执飞横贯大陆航线。'),
    h('Its eagle emblem dates to the 1930s.', '鹰形标志可追溯到1930年代。'),
  ],
  DAL: [
    h('Began as a crop-dusting outfit in the 1920s.', '起家于1920年代的农药喷洒作业。'),
    h("Its main hub is the world's busiest airport.", '其主枢纽是全球最繁忙的机场。'),
    h('A founding member of SkyTeam.', '天合联盟创始成员。'),
    h('Its triangular logo is nicknamed "the widget".', '三角形标志被昵称为"widget"。'),
    h('It owns an oil refinery.', '它拥有一座炼油厂。'),
    h('Slogan: "Keep Climbing".', '口号是"Keep Climbing"。'),
    h('One of the few US majors flying no 737 MAX.', '美国大型航司中少数不运营737 MAX的。'),
    h('Named after a river delta region.', '名字来自一条河流的三角洲地区。'),
    h('Operates large fleets of A350s and A330neos.', '运营大量A350和A330neo。'),
    h('Employees once bought it a 767 as a gift.', '员工曾集资为公司购买了一架767。'),
  ],
  UAL: [
    h('A founding member of Star Alliance.', '星空联盟创始成员。'),
    h('Launch customer of the Boeing 777.', '波音777的启动用户。'),
    h('Its logo is a blue globe.', '标志是一个蓝色地球。'),
    h('Its slogan mentions "friendly skies".', '口号里有"friendly skies"。'),
    h("Hubs include Chicago O'Hare and Denver.", '枢纽包括芝加哥奥黑尔和丹佛。'),
    h('Operates the most widebodies of any US carrier.', '美国航司中宽体机数量最多。'),
    h('Merged with Continental in 2010.', '2010年与大陆航空合并。'),
    h('Serves more destinations than any other airline.', '通航目的地数量全球第一。'),
    h('Its livery is blue and white with no red.', '涂装蓝白配色，没有红色。'),
    h("Headquartered in Chicago's Willis Tower.", '总部位于芝加哥威利斯大厦。'),
  ],
  SWA: [
    h('Flies only one aircraft family.', '只运营一个机型系列。'),
    h('The largest low-cost carrier in the world.', '全球最大的低成本航空。'),
    h('Its home field is Dallas Love Field.', '大本营是达拉斯爱田机场。'),
    h('Its stock ticker is LUV.', '股票代码是LUV。'),
    h('Famous for open seating for decades.', '数十年以不指定座位闻名。'),
    h('Paints hearts on its aircraft.', '飞机上画着爱心。'),
    h('Founded in Texas in 1971.', '1971年创立于得克萨斯。'),
    h('Never joined a global alliance.', '从未加入任何全球联盟。'),
    h('"Bags fly free" was a signature policy.', '"行李免费"曾是其招牌政策。'),
    h('Some jets wear US state-flag liveries.', '部分飞机是美国州旗彩绘。'),
  ],
  RYR: [
    h("Europe's largest airline by passengers.", '按客运量计欧洲最大的航空公司。'),
    h('Headquartered in Dublin.', '总部位于都柏林。'),
    h('Its logo is a golden harp.', '标志是一把金色竖琴。'),
    h('Calls its 737 MAX 8-200s "Gamechangers".', '把737 MAX 8-200称为"Gamechanger"。'),
    h('Famous for rock-bottom fares and add-on fees.', '以超低票价和各种附加费闻名。'),
    h('Its outspoken CEO has led it since 1994.', '直言不讳的CEO自1994年执掌至今。'),
    h('Blue and yellow livery.', '蓝黄涂装。'),
    h('Once floated charging for onboard toilets.', '曾放风要给机上厕所收费。'),
    h('Named after a family surname.', '名字来自一个家族姓氏。'),
    h('Its fleet is almost entirely Boeing narrow-bodies.', '机队几乎全是波音窄体机。'),
  ],
  EZY: [
    h('Bright orange branding.', '标志性亮橙色。'),
    h('Based at London Luton.', '基地在伦敦卢顿机场。'),
    h('Founded by a Greek-Cypriot entrepreneur in 1995.', '1995年由一位希腊裔塞浦路斯企业家创立。'),
    h('Flies only Airbus narrow-bodies.', '只飞空客窄体机。'),
    h('Its name starts with a lowercase letter.', '名字以小写字母开头。'),
    h('A UK reality TV series was filmed about it.', '曾有英国真人秀节目以它为主角。'),
    h("Europe's second-largest low-cost carrier.", '欧洲第二大低成本航空。'),
    h('Painted its booking phone number on fuselages early on.', '早年机身上涂着订票电话号码。'),
    h('Not a member of any alliance.', '不属于任何联盟。'),
    h('Its founder runs a family of "easy" brands.', '创始人旗下有一系列"easy"品牌。'),
  ],
  DLH: [
    h('Its crane logo dates back to 1918.', '鹤形标志可追溯到1918年。'),
    h('Main hubs are Frankfurt and Munich.', '主枢纽是法兰克福和慕尼黑。'),
    h('The largest passenger operator of the 747-8.', '747-8客机的最大运营商。'),
    h('A founding member of Star Alliance.', '星空联盟创始成员。'),
    h('Its group owns SWISS, Austrian and Brussels Airlines.', '集团旗下有瑞士、奥地利和布鲁塞尔航空。'),
    h("Flag carrier of Europe's largest economy.", '欧洲最大经济体的载旗航空。'),
    h('Its name honours a medieval trading league.', '名字源自中世纪的一个贸易同盟。'),
    h('Yellow and dark blue brand colors.', '品牌色为黄色与深蓝。'),
    h('Its loyalty program is Miles & More.', '常旅客计划是Miles & More。'),
    h('Still flies the A340 after most rivals retired it.', '在多数同行退役A340后仍在运营它。'),
  ],
  BAW: [
    h('Its tail design is inspired by the Union Flag.', '尾翼设计源自英国国旗。'),
    h('Main base is Heathrow Terminal 5.', '主基地是希思罗机场5号航站楼。'),
    h('One of only two airlines that flew Concorde.', '曾运营协和式客机的两家航司之一。'),
    h('A founding member of oneworld.', '寰宇一家创始成员。'),
    h('Formed by a merger of BOAC and BEA in 1974.', '1974年由BOAC与BEA合并而成。'),
    h('Motto: "To Fly. To Serve."', '格言是"To Fly. To Serve."。'),
    h('Introduced the first flat beds in business class.', '首创可完全平躺的商务舱座椅。'),
    h('Part of IAG alongside Iberia.', '与伊比利亚航空同属IAG集团。'),
    h("Its radio callsign honours a predecessor's bird emblem.", '呼号致敬前身公司的鸟形标志。'),
    h('Red, white and blue livery.', '红白蓝涂装。'),
  ],
  AFR: [
    h('Its historic logo was a winged seahorse.', '老标志是一只带翅膀的海马。'),
    h('Hub at Paris Charles de Gaulle.', '枢纽在巴黎戴高乐机场。'),
    h('One of only two airlines that flew Concorde.', '曾运营协和式客机的两家航司之一。'),
    h('A founding member of SkyTeam.', '天合联盟创始成员。'),
    h('Merged with a Dutch airline in 2004.', '2004年与一家荷兰航空公司合并。'),
    h('Its livery carries the national tricolor.', '涂装带有国旗三色条。'),
    h('Formed in 1933 from five merged carriers.', '1933年由五家公司合并成立。'),
    h('Known for inflight cuisine and champagne.', '以机上餐食和香槟闻名。'),
    h('Its first class is called La Première.', '头等舱产品叫La Première。'),
    h('Flies one of the largest Africa networks from Europe.', '欧洲航司中非洲航线网络最大之一。'),
  ],
  KLM: [
    h('The oldest airline still flying under its original name.', '仍以原名运营的最古老航空公司。'),
    h('Founded in 1919.', '创立于1919年。'),
    h('Gives business passengers Delft Blue miniature houses.', '向商务舱旅客赠送代尔夫特蓝陶小屋。'),
    h('Its name is a royal abbreviation.', '名字是一个带"皇家"字样的缩写。'),
    h('Hub at Amsterdam Schiphol.', '枢纽在阿姆斯特丹史基浦机场。'),
    h('Light blue livery.', '标志性浅蓝色涂装。'),
    h('Merged with Air France in 2004.', '2004年与法航合并。'),
    h('A SkyTeam member.', '天合联盟成员。'),
    h('Its crown logo is drawn with lines and dots.', '皇冠标志由线条和圆点组成。'),
    h("Flew the world's longest route in the 1930s.", '1930年代运营当时全球最长的航线。'),
  ],
  THY: [
    h('Flies to more countries than any other airline.', '通航国家数量全球第一。'),
    h('Moved into a purpose-built mega-hub in 2018.', '2018年迁入新建的超级枢纽机场。'),
    h('A Star Alliance member since 2008.', '2008年加入星空联盟。'),
    h('Its logo is a wild goose.', '标志是一只大雁。'),
    h('Based in a city that spans two continents.', '基地城市横跨两大洲。'),
    h('Serves meals from an onboard "flying chef".', '机上有"飞行厨师"服务。'),
    h('Red and white livery.', '红白涂装。'),
    h('Sponsors European football giants.', '赞助多支欧洲足球豪门。'),
    h('Its cargo arm ranks top-five worldwide.', '货运业务位居全球前五。'),
    h('Founded in 1933.', '创立于1933年。'),
  ],
  UAE: [
    h('Operates only wide-body aircraft.', '只运营宽体机。'),
    h('The largest operator of both the A380 and the 777.', 'A380和777的全球最大运营商。'),
    h('Its home airport has a dedicated A380 concourse.', '基地机场有A380专用航站楼。'),
    h("Owned by a Gulf emirate's government.", '由海湾一个酋长国的政府所有。'),
    h('Slogan: "Fly Better".', '口号是"Fly Better"。'),
    h('Cabin crew wear red hats with white veils.', '乘务员戴红帽配白纱。'),
    h('Offers onboard showers in first class.', '头等舱提供机上淋浴。'),
    h('Sponsors Real Madrid and Arsenal.', '赞助皇马和阿森纳。'),
    h('Never joined a global alliance.', '未加入任何全球联盟。'),
    h('Founded in 1985 with two leased aircraft.', '1985年靠两架租赁飞机起家。'),
  ],
  QTR: [
    h('Repeatedly named Skytrax airline of the year.', '多次被Skytrax评为年度最佳航空。'),
    h('Its logo is an oryx.', '标志是一只阿拉伯大羚羊。'),
    h('QSuite is its famous business class.', '商务舱产品是著名的QSuite。'),
    h('Hub at Hamad International.', '枢纽是哈马德国际机场。'),
    h('A oneworld member from the Gulf.', '海湾地区的寰宇一家成员。'),
    h('Its home country hosted the 2022 World Cup.', '所在国举办了2022年世界杯。'),
    h('Burgundy and grey livery.', '酒红与灰色涂装。'),
    h('Flies the A350, 777, 787 and A380 all at once.', '同时运营A350、777、787和A380。'),
    h("Its cargo division is among the world's largest.", '货运规模居全球前列。'),
    h('A state-owned flag carrier.', '国有载旗航空。'),
  ],
  SIA: [
    h('Cabin crew wear the sarong kebaya.', '乘务员制服是纱笼可芭雅。'),
    h('The first airline to fly the A380.', '全球首家运营A380的航空公司。'),
    h("Operates the world's longest nonstop flight.", '运营全球最长的直飞航线。'),
    h('Has no domestic routes at all.', '完全没有国内航线。'),
    h('The "Girl" in its ads is a national icon.', '广告中的"空姐"形象是国民符号。'),
    h('A Star Alliance member.', '星空联盟成员。'),
    h('Its bird logo is based on a silver kris dagger.', '标志源自马来克力士短剑。'),
    h('Consistently top-three in world airline rankings.', '常年位居全球航司排名前三。'),
    h('Its crew training college is industry-famous.', '空乘培训学院业内闻名。'),
    h('Yellow, blue and white livery.', '黄蓝白涂装。'),
  ],
  CPA: [
    h('Its logo is a calligraphic "brushwing".', '标志是"翘首振翅"的笔触图形。'),
    h('Based at an airport built on reclaimed land.', '基地机场建在填海土地上。'),
    h('Founded in 1946 by an American and an Australian.', '1946年由一位美国人和一位澳大利亚人创立。'),
    h('The Swire group is its major shareholder.', '太古集团是其主要股东。'),
    h('A oneworld founding member.', '寰宇一家创始成员。'),
    h('Its name is an old term for a mythical far-off land.', '名字源自一个神秘远方国度的古称。'),
    h('Green brand color.', '品牌色是绿色。'),
    h('Has no domestic network.', '没有国内航线网络。'),
    h("Its cargo arm ranks among the world's largest.", '货运常年位居全球前列。'),
    h('Freighter 747s are a fixture at its home base.', '基地常见其747货机。'),
  ],
  ANA: [
    h('The launch customer of the Boeing 787.', '波音787的全球启动用户。'),
    h("Japan's largest airline.", '日本最大的航空公司。'),
    h('Has painted Pokémon and Star Wars jets.', '涂装过宝可梦和星球大战彩绘机。'),
    h('A Star Alliance member.', '星空联盟成员。'),
    h('Blue-striped livery.', '蓝色条纹涂装。'),
    h('Flies sea-turtle-liveried A380s to Honolulu.', '用海龟彩绘A380执飞檀香山。'),
    h('Its initials mean "All Nippon".', '缩写意为"全日本"。'),
    h('Began as a helicopter operator in 1952.', '1952年以直升机公司起家。'),
    h('Hubs at Haneda and Narita.', '枢纽是羽田和成田。'),
    h('A Skytrax five-star airline.', 'Skytrax五星航司。'),
  ],
  JAL: [
    h('Its logo is a red crane.', '标志是一只红色仙鹤。'),
    h('Rebounded from a major bankruptcy in 2010.', '2010年经历破产重组后重生。'),
    h('A oneworld member.', '寰宇一家成员。'),
    h('Once operated more 747s than anyone else.', '曾是全球运营747最多的航司。'),
    h('Red and white livery.', '红白涂装。'),
    h('Its crane emblem is called the tsurumaru.', '鹤形标志名为"鹤丸"。'),
    h('Opened trans-Pacific service in 1954.', '1954年开通跨太平洋航线。'),
    h('Its low-cost sibling is ZIPAIR.', '旗下低成本品牌是ZIPAIR。'),
    h('Famous for punctuality awards.', '以准点率闻名。'),
    h('Hubs at Haneda and Narita.', '枢纽是羽田和成田。'),
  ],
  KAL: [
    h('Its livery is a distinctive sky blue.', '标志性天蓝色涂装。'),
    h('Its logo resembles a red-and-blue taegeuk swirl.', '标志类似红蓝太极图案。'),
    h('A founding member of SkyTeam.', '天合联盟创始成员。'),
    h('Absorbing its biggest domestic rival.', '正在并购国内最大的竞争对手。'),
    h('Main hub at Incheon.', '主枢纽在仁川机场。'),
    h('Its cargo arm is a global top-five.', '货运业务位居全球前五。'),
    h('Serves bibimbap onboard.', '机上供应拌饭。'),
    h('Relaunched from a state carrier in 1969.', '1969年由国营公司改制而来。'),
    h('Flies both the A380 and 747-8 as passenger jets.', '同时运营A380和747-8客机。'),
    h('Owned by the Hanjin group.', '隶属韩进集团。'),
  ],
  QFA: [
    h('Its logo is a white kangaroo.', '标志是一只白色袋鼠。'),
    h('The oldest airline in the English-speaking world.', '英语世界最古老的航空公司。'),
    h('Its name is an acronym of its outback origins.', '名字是其内陆发源地的首字母缩写。'),
    h('"Project Sunrise" aims to fly Sydney–London nonstop.', '"日出计划"要直飞悉尼-伦敦。'),
    h('Has never lost a jet airliner in a fatal crash.', '喷气时代从未发生致命空难。'),
    h('Famously name-checked in the film Rain Man.', '在电影《雨人》里被点名称赞。'),
    h('A oneworld founding member.', '寰宇一家创始成员。'),
    h('Red tail with a white roo.', '红色尾翼配白色袋鼠。'),
    h('Its budget sibling is Jetstar.', '旗下低成本品牌是捷星。'),
    h('Flies Perth–London nonstop.', '运营珀斯-伦敦直飞航线。'),
  ],
  ACA: [
    h('A red maple leaf marks its tail.', '尾翼上是红色枫叶。'),
    h('A founding member of Star Alliance.', '星空联盟创始成员。'),
    h('Hubs at Toronto, Montreal and Vancouver.', '枢纽在多伦多、蒙特利尔和温哥华。'),
    h('Its loyalty program is Aeroplan.', '常旅客计划是Aeroplan。'),
    h('Adopted a black-and-white livery in 2017.', '2017年启用黑白涂装。'),
    h('Its leisure brand is called Rouge.', '旗下休闲品牌叫Rouge。'),
    h('Flag carrier of the second-largest country by area.', '国土面积第二大国家的载旗航空。'),
    h('Began in 1937 as Trans-Canada Air Lines.', '1937年以跨加拿大航空起家。'),
    h('787s form its long-haul backbone.', '787是其远程航线主力。'),
    h('Makes bilingual English-French announcements.', '机上使用英法双语广播。'),
  ],
};

/** Data-driven hints available for every airline. */
function templateHints(a: Airline): Hint[] {
  const name = a.name;
  const letters = name.replace(/[^A-Za-z]/g, '').length;
  const words = name.trim().split(/\s+/).length;
  const hints: Hint[] = [];
  if (a.callsign) hints.push({ tpl: 'callsign', value: a.callsign });
  hints.push(
    a.alliance ? { tpl: 'alliance', value: a.alliance } : { tpl: 'allianceNone', value: '' },
  );
  hints.push({ tpl: 'nameStarts', value: name[0].toUpperCase() });
  hints.push({ tpl: 'nameLetters', value: letters });
  if (a.iata) hints.push({ tpl: 'iataStarts', value: a.iata[0] });
  hints.push({ tpl: 'nameWords', value: words });
  hints.push({ tpl: /\bair\b/i.test(name) ? 'hasAir' : 'noAir', value: '' });
  return hints;
}

/** A freshly shuffled hint pool for one game session. */
export function airlineHintPool(a: Airline): Hint[] {
  return shuffle([...(CURATED[a.icao] ?? []), ...templateHints(a)]);
}
