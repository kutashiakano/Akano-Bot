const axios = require("axios");

async function removebg(input) {
  try {
    if (!input)
      return {
        status: false,
        message: "Input is undefined",
      };
    let image;
    if (Buffer.isBuffer(input)) {
      image = input.toString("base64");
    } else if (typeof input === "string" && input.startsWith("http")) {
      const response = await axios.get(input, {
        responseType: "arraybuffer",
      });
      image = Buffer.from(response.data, "binary").toString("base64");
    } else {
      return {
        status: false,
        message: "Invalid input format",
      };
    }
    return await new Promise((resolve, reject) => {
      axios
        .post(
          "https://us-central1-ai-apps-prod.cloudfunctions.net/restorePhoto",
          {
            image: `data:image/png;base64,${image}`,
            model:
              "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
          },
        )
        .then((res) => {
          const data = res.data?.replace(/"/g, "");
          console.log(res.status, data);
          if (!data) return reject("Failed to remove background from image");
          resolve({
            status: true,
            image: data,
          });
        })
        .catch(reject);
    });
  } catch (e) {
    return {
      status: false,
      message: e.message || e,
    };
  }
}

module.exports = removebg;
