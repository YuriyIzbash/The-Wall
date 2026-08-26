// Graffiti fonts
const fonts = [
  'A Another Tag, cursive',
  'Street Wars, sans-serif',
  'Mostwasted, sans-serif',
  'Jraot Hollow, sans-serif',
  'Docallisme on Street, cursive',
  'A Dripping Marker, cursive',
  'DropShade-Melt, cursive',
  'FankyBubbleGraffiti-Line, cursive',
  'Ghoust Solid, cursive',
  'Graffiti Treat, cursive',
  'GraffitiNewDemoRegular, cursive',
  'Kortz DEMO, cursive',
  'MARKER-NO2HUN, cursive',
  'MARSNEVENEKSK-Regular, cursive',
  'Mersey Cowboy, cursive',
  'More Than Life, cursive',
  'NightclawVandalReg-Solid, cursive',
  'No_License_Ghang, cursive',
  'NoctraDrip-SolidMelt, cursive',
  'ONE PIECE, cursive',
  'Painterz, cursive',
  'Rebeland Regular, cursive',
  'RockerRusher, cursive',
  'RollbeatGraffiti, cursive',
  'SoachaLetterFont-Regular, cursive',
  'Spoken_PERSONAL, cursive',
  'Step Better, cursive',
  'Street Wars Demo, cursive',
  'StreetartDemoRegular, cursive',
  'THE_JACATRA, cursive',
  'Throw-up Font, cursive',
  'UrbanSketart, cursive',
  'aAttackGraffiti, cursive',
  'bboy, cursive',
  'graffonti.atomic.bomb, cursive',
  'sickcapital-vice, cursive',
];

// Text colors
const textColors = [
  '#ff4d4d',
  '#ff9900',
  '#ffcc00',
  '#66ff66',
  '#66ccff',
  '#ff66ff',
  '#ff3399',
  '#ff6600',
  '#ff0066',
  '#ff3366',
  '#ff9933',
  '#66ff99',
  '#00ccff',
  '#cc66ff',
  '#ff66cc',
  '#ff9966',
  '#99ff66',
  '#66ffcc',
  '#cc66cc',
  '#ff3399',
  '#ff6600',
  '#ffcc66',
  '#66ff33',
  '#33ccff',
  '#ff6666',
  '#66ffcc',
  '#cc99ff',
];

// Gradient pairs
const gradients = [
  ['#ff4d4d', '#ff9900'],
  ['#ffcc00', '#ff6600'],
  ['#66ccff', '#ff66ff'],
  ['#ff3399', '#ff6600'],
  ['#66ff66', '#66ccff'],
  ['#ff4d4d', '#ff3399'],
  ['#ff9900', '#ffcc00'],
  ['#66ccff', '#ff3399'],
  ['#ff0066', '#ffcc00'],
  ['#ff9933', '#ff3399'],
  ['#66ff99', '#00ccff'],
  ['#cc66ff', '#ff66cc'],
  ['#ff9966', '#66ff33'],
  ['#ff3366', '#66ffcc'],
  ['#99ff66', '#cc66ff'],
  ['#ffcc66', '#ff0066'],
  ['#33ccff', '#ff6666'],
  ['#ff66cc', '#66ff99'],
];

// Default shadow
const defaultShadow = '4px 4px 12px rgba(0,0,0,0.4), 0 0 10px rgba(0,0,0,0.1)';

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const getRandomGraffitiStyle = () => {
  return {
    fontFamily: randomItem(fonts),
    textColor: randomItem(textColors),
    gradient: randomItem(gradients),
    shadow: defaultShadow,
  };
};