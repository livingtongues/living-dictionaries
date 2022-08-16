import pdf from 'html-pdf';

const options = { format: 'Letter' };

export default function toPDF(html, file) {
  pdf.create(html, options).toFile(file, (err, res) => {
    if (err) return console.log(err);
    console.log(res);
  });
}
