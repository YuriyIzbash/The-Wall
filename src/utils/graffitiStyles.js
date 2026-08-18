// Graffiti fonts
const fonts = [
  'A Another Tag, cursive',
  'Street Wars, sans-serif',
  'Mostwasted, sans-serif',
  'Jraot Hollow, sans-serif',
  'Docallisme on Street, cursive',
  'A Dripping Marker, cursive',
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
];

// Default shadow for all graffiti
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