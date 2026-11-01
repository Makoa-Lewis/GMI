# GMI
Global Music Initiative website

## Pages
- index.html home · how.html how it works · makoa.html founder portfolio
- join.html student application with financial need · mentor.html mentor interest · apply.html 2027 Nepal cohort
- nepal.html Nepal project and archive explorer · team.html team and governance · partners.html partners and investors
- login.html, student.html, admin.html portal demos with sample data (portal.js)
- plan.html and vanderbilt.html now redirect to partners.html and team.html

Styles are styles.css, ai.css and v2.css. Forms send through formsubmit.co to info@globalmusicinitiative.org.

## Hulili AI features

Files are `ai.css` and `ai.js`, loaded on every page.

- **Mentorship Advisor** is in the `#mentorship` section of `index.html`
- **Archival AI Explorer** is in the `#archive` section of `index.html`
- **Ask Hulili drawer** is added to every page automatically by `ai.js`

Right now every answer comes from built-in mock responses, so the site works without a backend.

### Connecting the real model

1. Build a small server route (a Netlify, Vercel or Cloudflare function) that receives the request, adds your secret API key, and forwards it to the custom model.
2. Put that route's URL in `endpoint` at the top of `ai.js`, or set it before `ai.js` loads

   ```html
   <script>window.GMI_AI_CONFIG = { endpoint: "https://YOUR-ROUTE/v1/query" };</script>
   ```

3. Have the route return JSON in the shape described at the top of `ai.js`.

Never put an API key in `ai.js`. Anything in front-end JavaScript is public.

Set `mockFallback: false` once the model is live if you'd rather show an error than a mock answer when the backend is down.
