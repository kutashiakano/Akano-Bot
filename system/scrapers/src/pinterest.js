const axios = require('axios');
const cheerio = require('cheerio');

class Pinterest {
   download = async function pindl(url) {
  try {
    let response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' 
      }
    }).catch(e => e.response);
    let $ = cheerio.load(response.data);
    let tag = $('script[data-test-id="video-snippet"]');
    let result = JSON.parse(tag.text());
    if (!result || !result.name || !result.thumbnailUrl || !result.uploadDate || !result.creator) {
        return {
      msg: "- Data tidak ditemukan, coba pakai url lain"
       };
    }
    return {
      title: result.name,
      thumb: result.thumbnailUrl,
      upload: (new Date(result.uploadDate)).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
      }),
      source: result["@id"],
      author: {
        name: result.creator.alternateName,
        username: "@" + result.creator.name,
        url: result.creator.url
      },
      keyword: result.keywords ? result.keywords.split(", ").map(keyword => keyword.trim()) : [],
      download: result.contentUrl
    };
  } catch (e) {
    console.error("- Error Log :", e);
    return {
      msg: "- Function Error coba lagi lain waktu"
       };
     }
  }
}

module.exports = new Pinterest()