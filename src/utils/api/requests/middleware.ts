export async function pageNotFound(ctx, next) {
	return next().then(() => {
		if (ctx.status === 404) {
			ctx.body = `
            <!doctype html>
            <html lang="en">
            
            <head>
              <meta charset="utf-8">
              <title>Page Not Found</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                * {
                  line-height: 1.2;
                  margin: 0;
                }
            
                html {
                  color: white;
                  display: table;
                  font-family: sans-serif;
                  height: 100%;
                  text-align: center;
                  width: 100%;
                }
            
                body {
                  background-color: #212120;
                  display: table-cell;
                  vertical-align: middle;
                  margin: 2em auto;
                }
            
                h1 {
                  font-size: 2em;
                  font-weight: 400;
                }
            
                p {
                  margin: 0 auto;
                  width: 280px;
                }
            
                @media only screen and (max-width: 280px) {
            
                  body,
                  p {
                    width: 95%;
                  }
            
                  h1 {
                    font-size: 1.5em;
                    margin: 0 0 0.3em;
                  }
            
                }
              </style>
            </head>
            
            <body>
              <h1>Page Not Found</h1>
              <p>Sorry, but the page you were trying to view does not exist.</p>
            </body>
            
            </html>
        `
			console.error(
				`404 - Page Not Found - Endpoint => ${ctx.request.url}`,
			)
		}
	})
}
