const axios = require('axios');

const hika = {
  api: {
    base: "https://api.hika.fyi/api/",
    kbase: "kbase/web",
    advanced: "kbase/web/advanced",
    mindmap: "answer/transform/mindmap",
    keywords: "answer/transform/keywords"
  },

  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://hika.fyi',
    'Referer': 'https://hika.fyi/',
    'User-Agent': 'Postify/1.0.0'
  },

  types: ['chat', 'advanced', 'mindmap', 'keywords'],

  generateId: async () => {
    const uid = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const hashId = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`#${uid}*`))
      .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join(""));
    return { uid, hashId };
  },

  checkPayload: (payload, fields) => fields.filter(field => !payload[field] || (Array.isArray(payload[field]) && !payload[field].length)),

  parse: (response) => {
    let result = { text: '' };
    if (typeof response.data === 'string') {
      response.data.split('\n').forEach(line => {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) result.text += data.chunk;
            if (data.topic_id) result.topicId = data.topic_id;
            if (data.references) result.references = data.references;
            if (data.response_id) result.rid = data.response_id;
          } catch (e) {}
        }
      });
    }
    return result;
  },

  chat: async (type = '', options = {}) => {
    if (!type || !hika.types.includes(type)) {
      return {
        status: false,
        code: 400,
        type: 'error',
        message: 'Invalid type provided',
        required: {
          type: `Available types: ${hika.types.join(', ')}`,
          options: {
            chat: { keyword: 'Search keyword (minimum 2 characters)', language: 'Language code' },
            advanced: { keyword: 'Search keyword (minimum 2 characters)', language: 'Language code' },
            mindmap: { rid: 'Response ID from previous search', keywords: 'Array of keywords for mindmap', language: 'Language code' },
            keywords: { rid: 'Response ID from previous search', language: 'Language code' }
          }
        }
      };
    }

    try {
      const { uid, hashId } = await hika.generateId();
      const headers = { ...hika.headers, 'x-hika': hashId, 'x-uid': uid };

      const handlers = {
        chat: async () => {
          const payload = { keyword: options.keyword, language: options.language || 'id', stream: true };
          const missingFields = hika.checkPayload(payload, ['keyword']);

          if (missingFields.length) return {
            status: false,
            code: 400,
            type,
            message: 'Required parameters are missing',
            required: {
              missing: missingFields,
              payload: {
                keyword: 'Search keyword (minimum 2 characters)',
                language: 'Language code, default: id',
                stream: 'Boolean, default: true'
              }
            }
          };

          if (payload.keyword.length < 2) return {
            status: false,
            code: 400,
            type,
            message: 'Keyword is too short, minimum 2 characters required',
            payload: { current: payload, required: { keyword: 'Minimum 2 characters' } }
          };

          const response = await axios.post(`${hika.api.base}${type === 'chat' ? hika.api.kbase : hika.api.advanced}`, payload, { headers });
          if (!response.data) return { status: false, code: 404, type, message: 'No content found for the provided query' };

          const result = hika.parse(response);
          return {
            status: true,
            code: 200,
            data: {
              type,
              query: payload.keyword,
              language: payload.language,
              timestamp: new Date().toISOString(),
              text: result.text.replace(/<[^>]*>/g, '').trim(),
              topicId: result.topicId,
              references: result.references,
              rid: result.rid
            }
          };
        },

        mindmap: async () => {
          const payload = { response_id: options.rid, keywords: options.keywords, language: options.language || 'id', stream: true };
          const missingFields = hika.checkPayload(payload, ['response_id', 'keywords']);

          if (missingFields.length) return {
            status: false,
            code: 400,
            type,
            message: 'Required parameters are missing',
            required: {
              missing: missingFields,
              payload: {
                response_id: 'Response ID from previous search',
                keywords: 'Array of keywords for mindmap',
                language: 'Language code, default: id',
                stream: 'Boolean, default: true'
              }
            }
          };

          const response = await axios.post(`${hika.api.base}${hika.api.mindmap}`, payload, { headers });
          const result = hika.parse(response);
          return { status: true, code: 200, data: { type, text: result.text } };
        },

        keywords: async () => {
          const payload = { response_id: options.rid, language: options.language || 'id', stream: true };
          const missingFields = hika.checkPayload(payload, ['response_id']);

          if (missingFields.length) return {
            status: false,
            code: 400,
            type,
            message: 'Required parameters are missing',
            required: {
              missing: missingFields,
              payload: {
                response_id: 'Response ID from previous search',
                language: 'Language code, default: id',
                stream: 'Boolean, default: true'
              }
            }
          };

          const response = await axios.post(`${hika.api.base}${hika.api.keywords}`, payload, { headers });
          const result = hika.parse(response);
          return { status: true, code: 200, data: { type, text: result.text } };
        }
      };

      handlers.advanced = handlers.chat;
      return await (handlers[type] || (() => ({ status: false, code: 400, type: 'error', message: 'Invalid type provided' })))();

    } catch (error) {
      return {
        status: false,
        code: error.response?.status || 500,
        type: type || 'error',
        message: error.response?.data?.message || 'An error occurred, please try again later'
      };
    }
  }
};

module.exports = hika 