const axios = require("axios");
const cheerio = require("cheerio");

class Anoboy {
    search = async function search(q) {
  return new Promise(async (resolve, reject) => {
    await axios
      .get("https://anoboy.li/?s=" + encodeURIComponent(q))
      .then(async ({ data }) => {
        let $ = cheerio.load(data);
        let array = [];
        $(".bsx").each((a, i) => {
          array.push({
            title: $(i)
              .find("a > .tt")
              .text()
              .replace($(i).find("a > .tt > h2").text(), "")
              .trim(),
            type: $(i).find(".limit > .typez").text(),
            thumb: $(i).find(".limit > img").attr("src"),
            url: $(i).find("a").attr("href"),
          });
        });
        resolve(array);
       });
   });
 }
}

module.exports = new Anoboy()