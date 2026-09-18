function extNews(sock) {
  if (!sock.newsletterMetadata) {
    sock.newsletterMetadata = async (type, jid) => await sock.query({
      tag: "xmpp",
      attrs: {},
      content: [ {
        tag: "query",
        attrs: {
          jid: jid,
          type: type
        }
      } ]
    }).catch(() => null);
  }
}

module.exports = {
  extNews: extNews
};