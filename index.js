const app = require('express')();
const { search } = require('yt-search');
const ytdl = require('ytdl-core');
const Spotify = require('spotify-web-api-node');
const { createWriteStream } = require('fs');

const api = new Spotify({
    clientId: '05b24fb8ffde41c384ac3d5b54f97cf2',
    clientSecret: '55eb2f966f0d401493f46a1c3c7b7ddd',
    redirectUri: 'http://localhost:3000/callback'
});

const token = 'BQBsPkpnlrJjEJM-VQe-f-bctabRHwqgZ9Aag6nCH350qcKfyeEd6kXWKHpX_ayP7O5AbP68iXHB4t4tk4_GylUgPHh6qLdt2V4rvqakThajsTTryXftvy2smJkAtldwTKXpLM2Tko0x9ZVS02j0u25R0pOyPIv5fp_Z_k2OjEQjj0unlI3ujySsEY8gnE-xSOOlgn_FMYMJqI20pNivhYQJmtj0BfUpTKLp';

const formattrack = (res) => {
    return {
        name: res.name,
        duration: res.duration_ms,
        id: res.id,
        artist: res.artists[0].name,
        image: res.album.images[0].url
    };
};

const formatsearch = (res) => {
    const songs = [];
    res.forEach(val => {
        songs.push({
            id: val.videoId,
            title: val.title,
            image: val.image,
            artist: val.author.name
        });
    });
    return songs;
}

app.get('/login', (req, res) => {
    res.redirect(api.createAuthorizeURL(['playlist-read-private', 'user-read-private', 'user-library-read'], 'state'));
});
app.get('/callback', (req, res) => {
    api.authorizationCodeGrant(req.query.code).then(({ body }) => {
        console.log(`tokens:\n${body.access_token}\n${body.refresh_token}`);
        res.send(`authorized ${body.access_token}`);
    });
});

app.get('/yt/:id', (req, res) => {
    ytdl(`https://www.youtube.com/watch?v=${req.params.id}`, { filter: 'audioonly', quality: 'highestaudio' })
        .pipe(createWriteStream(`${req.params.id}.mp3`))
        .on('finish', () => res.download(`${req.params.id}.mp3`));
});

app.get('/search/:term', async (req, res) => {
    const { videos } = await search(req.params.term);
    console.log(videos);
    res.send(formatsearch(videos));
});

app.get('/spot/:id', async (req, res) => {
    api.setAccessToken(token);
    const data = await api.getTrack(req.params.id);
    const str = `${data.body.name} ${data.body.artists[0].name}`;
    console.log(str);

    const ress = await search(str);
    const url = ress.videos[0].url;
    const id = ress.videos[0].videoId;

    ytdl(url, { format: 'highestaudio', filter: 'audioonly' })
        .pipe(createWriteStream(`${id}.mp3`))
        .on('finish', () => res.download(`${id}.mp3`));
});

app.get('/yt/:id', (req, res) => {
    ytdl(`https://www.youtube.com/watch?v=${req.params.id}`, { filter: 'audioonly', quality: 'highestaudio' })
        .pipe(createWriteStream(`${req.params.id}.mp3`))
        .on('finish', () => res.download(`${req.params.id}.mp3`));
});

app.listen(3000, () => console.log('app listening'));