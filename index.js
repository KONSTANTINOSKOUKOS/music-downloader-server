const cors = require('cors');
const app = require('express')();

app.use(cors({ origin: '*' }));

const { search } = require('yt-search');
const ytdl = require('ytdl-core');
const Spotify = require('spotify-web-api-node');
const { createWriteStream } = require('fs');

const api = new Spotify({
    clientId: '05b24fb8ffde41c384ac3d5b54f97cf2',
    clientSecret: '55eb2f966f0d401493f46a1c3c7b7ddd',
    redirectUri: 'https://music-downloader-pi.vercel.app/login'
});

const formattrack = (res) => {//used in other format()'s
    return {
        name: res.name,
        duration: res.duration_ms,
        id: res.id,
        artist: res.artists[0].name,
        image: res.album.images[0].url
    };
};

const formatalbum = (res) => {//for /album
    const tracks = [];
    res.tracks.items.forEach(el => {
        tracks.push({//no image bcz all the same
            name: el.name,
            duration: el.duration_ms,
            id: el.id,
            artist: el.artists[0].name,
        });
    });
    return {
        name: res.name,
        id: res.id,
        artist: res.artists[0].name,
        tracks: tracks,
        image: res.images[0].url
    };
};

const formatplaylist = (res) => {//for /playlist
    const tracks = [];
    res.tracks.items.forEach(el => {
        tracks.push(formattrack(el.track));
    });
    return {
        name: res.name,
        id: res.id,
        owner: res.owner.display_name,
        tracks: tracks,
        image: res.images[0].url
    };
};

const formatsearch = (res) => {
    const trs = [];
    res.tracks.items.forEach(el => {
        trs.push(formattrack(el));
    });
    const pls = [];
    res.playlists.items.forEach(el => {
        pls.push({//                      !!!! NO TRACKS
            name: el.name,
            owner: el.owner.display_name,
            image: el.images[0].url,
            id: el.id
        });
    });
    const als = [];
    res.albums.items.forEach(el => {
        als.push({//                      !!!! NO TRACKS
            name: el.name,
            id: el.id,
            artist: el.artists[0].name,
            image: el.images[0].url
        });
    });
    return {
        tracks: trs,
        playlists: pls,
        albums: als
    }
}

const formatlikedpls = (res) => {
    const pls = [];
    res.items.forEach(el => {
        pls.push({
            name: el.name,
            owner: el.owner.display_name,
            image: el.images[0].url,
            id: el.id
        });
    });
    return {
        pls: pls
    }
};

const formatusertrs = (res) => {
    const trs = [];
    res.items.forEach(el => {
        trs.push(formattrack(el.track));
    });
    return {
        trs: trs
    }
};

const formatuserals = (res) => {
    const als = [];
    res.items.forEach(el => {
        als.push(formatalbum(el.album));
    });
    return {
        als: als
    }
};


app.get('/login', (req, res) => {
    res.send(api.createAuthorizeURL(['playlist-read-private', 'user-read-private', 'user-library-read'], 'state'));
});
app.get('/token/:code', (req, res) => {
    api.setRedirectURI('https://music-downloader-pi.vercel.app/login');
    api.authorizationCodeGrant(req.params.code).then(({ body }) => {
        console.log(`tokens:\n${body.access_token}\n${body.refresh_token}`);
        res.json({
            token: body.access_token,
            refresh: body.refresh_token,
            expire: body.expires_in
        });
    });
});

app.get('/refresh/:refresh', (req, res) => {
    api.refreshAccessToken().then(({ body }) => {
        console.log(`tokens:\n${body.access_token}\n${body.refresh_token}`);
        res.json({
            token: body.access_token,
            refresh: body.refresh_token,
            expire: body.expires_in
        });
    })
});

app.get('/:token/search/:term', cors({ origin: '*' }), async (req, res) => {
    api.setAccessToken(req.params.token);
    const data = await api.search(req.params.term, ['track', 'playlist', 'album'], { limit: 20 });
    res.json(formatsearch(data.body));
});

app.get('/:token/playlist/:id', cors({ origin: '*' }), async (req, res) => {
    api.setAccessToken(req.params.token);
    const data = await api.getPlaylist(req.params.id);
    res.json(formatplaylist(data.body));
});

app.get('/:token/album/:id', cors({ origin: '*' }), async (req, res) => {
    api.setAccessToken(req.params.token);
    const data = await api.getAlbum(req.params.id);
    res.json(formatalbum(data.body));
});

app.get('/yt/:id', (req, res) => {
    ytdl(`https://www.youtube.com/watch?v=${req.params.id}`, { filter: 'audioonly', quality: 'highestaudio' })
        .pipe(createWriteStream(`${req.params.id}.mp3`))
        .on('finish', () => res.download(`${req.params.id}.mp3`));
});

app.get('/:token/spot/:id', async (req, res) => {
    api.setAccessToken(req.params.token);
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

app.get('/:token/me', cors({ origin: '*' }), async (req, res) => {
    api.setAccessToken(req.params.token);
    const data = await api.getMe();
    const image = data.body.images[0].url;
    res.json(image ? { name: data.body.display_name, image: image } : { name: data.body.display_name });
});

app.get('/:token/usertrs', cors({ origin: '*' }), async (req, res) => {//liked tracks
    api.setAccessToken(req.params.token);
    const data = await api.getMySavedTracks({ limit: 50 });
    res.json(formatusertrs(data.body));
});

app.get('/:token/userpls', cors({ origin: '*' }), async (req, res) => {//this has all the playlists(made + following)
    api.setAccessToken(req.params.token);
    const data = await api.getUserPlaylists({ limit: 50 });
    res.json(formatlikedpls(data.body));
});

app.get('/:token/userals', cors({ origin: '*' }), async (req, res) => {
    api.setAccessToken(req.params.token);
    const data = await api.getMySavedAlbums({ limit: 50 });
    res.json(formatuserals(data.body));
});

app.listen(3000, () => console.log('app listening'));