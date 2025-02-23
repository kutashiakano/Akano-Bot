const axios = require("axios");

const client_id = "acc6302297e040aeb6e4ac1fbdfd62c3";
const client_secret = "0e8439a1280a43aba9a5bc0a16f3f009";
const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

async function spotifyCreds() {
    try {
        const response = await axios.post(TOKEN_ENDPOINT, "grant_type=client_credentials", {
            headers: { Authorization: "Basic " + basic },
        });
        return {
            status: true,
            data: response.data,
        };
    } catch (error) {
        return { status: false, msg: "Failed to retrieve Spotify credentials." };
    }
}

const toTime = (ms) => {
    let h = Math.floor(ms / 3600000);
    let m = Math.floor(ms / 60000) % 60;
    let s = Math.floor(ms / 1000) % 60;
    return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(":");
};

class Spotify {
 search = async(query, type = "track", limit = 20) => {
        try {
            const creds = await spotifyCreds();
            if (!creds.status) return creds;

            const response = await axios.get(`https://api.spotify.com/v1/search?query=${encodeURIComponent(query)}&type=${type}&offset=0&limit=${limit}`, {
                headers: { Authorization: "Bearer " + creds.data.access_token },
            });

            if (!response.data[type + "s"] || !response.data[type + "s"].items.length) {
                return { msg: "Music not found!" };
            }

            return response.data[type + "s"].items.map(item => ({
                title: item.name,
                id: item.id,
                duration: toTime(item.duration_ms),
                artist: item.artists.map(artist => artist.name).join(" & "),
                url: item.external_urls.spotify
            }));
        } catch (error) {
            return { status: false, msg: "Error searching for music. " + error.message };
        }
    }

  download = async(url) => {
        return new Promise(async (resolve, reject) => {
            const BASEURL = "https://api.fabdl.com";
            try {
                const { data: info } = await axios.get(`${BASEURL}/spotify/get?url=${url}`, {
                    headers: {
                        Accept: "application/json, text/plain, */*",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
                    },
                }).catch(e => e.response);
            console.log(info);
              while (true) {
                    try {
                        const { data: download } = await axios.get(`${BASEURL}/spotify/mp3-convert-task/${info.result.gid}/${info.result.id}`, {
                            headers: {
                                Accept: "application/json, text/plain, */*",
                                "Content-Type": "application/json",
                                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
                            },
                        }).catch(e => e.response);
                      console.log(download);
                        if (download.result.download_url) {
                            resolve({
                                title: info.result.name,
                                cover: info.result.image,
                                duration: toTime(info.result.duration_ms),
                                download: `${BASEURL}${download.result.download_url}`,
                            });
                            break;
                        }
                    } catch (e) {
                        console.error("Retrying...", e.message);
                        await new Promise(res => setTimeout(res, 1000));
                    }
                }
            } catch (error) {
                reject("Error downloading Spotify track: " + error.message);
            }
        });
    }
}

module.exports = new Spotify();