const cheerio = require("cheerio");
const { fetch } = require("undici");
const { lookup } = require("mime-types");

async function mediafire(url) {
    return new Promise(async (resolve, reject) => {
           const response = await fetch(url);
            const html = await response.text();
            const $ = cheerio.load(html);

            const type = $('.dl-info').find('.filetype > span').text().trim();
            const filename = $('.dl-info').find('.intro .filename').text();
            const size = $('.details li:contains("File size:") span').text();
            const uploaded = $('.details li:contains("Uploaded:") span').text()
         const ext =
      /\(\.(.*?)\)/
        .exec($(".dl-info").find(".filetype > span").eq(1).text())?.[1]
        ?.trim() || "bin";
          const mimetype = lookup(ext.toLowerCase()) || "application/" + ext.toLowerCase();
           const download = $(".input").attr('href');
            resolve({
                filename,
                type,
                size,
                uploaded,
                ext,
                mimetype,
                download
            });
    }).catch(e => reject({
     msg: "Gagal mengambil data dari link tersebut"
})); 
}

module.exports = mediafire