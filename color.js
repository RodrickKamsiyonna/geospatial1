const { Vibrant } = require('node-vibrant/node');
Vibrant.from('public/sproxil-logo.jpg').getPalette()
  .then((palette) => console.log(palette))
  .catch(console.error);
