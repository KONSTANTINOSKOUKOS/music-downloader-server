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

const token = 'BQBfuNTmbR-iZYml6y2cYCD2zkABsKBZgYNPSR5EySG02ZWFTZzCuwDnXi_gpJE4Ga-fKAcd1iZjYEtdfapeK8Aztmc2YK55aIMVX0cW3EzFfZfQJQeV0MUaa4VvceK3bxW8hxnlxhNOYWj0fhSigzV9-IgJCUVnOuIJm-S20NBIxoLMgr9iG0CmN8aOPl7ZppG9lB72FQQ_oUR-9Px4Z4J46Y36nlJL43bE';

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
    res.redirect(api.createAuthorizeURL(['playlist-read-private', 'user-read-private', 'user-library-read'], 'state'));
});
app.get('/callback', (req, res) => {
    api.authorizationCodeGrant(req.query.code).then(({ body }) => {
        console.log(`tokens:\n${body.access_token}\n${body.refresh_token}`);
        res.send(`authorized ${body.access_token}`);
    });
});

app.get('/search/:term', async (req, res) => {
    api.setAccessToken(token);
    const data = await api.search(req.params.term, ['track', 'playlist', 'album'], { limit: 20 });
    res.json(formatsearch(data.body));
});

app.get('/playlist/:id', async (req, res) => {
    api.setAccessToken(token);
    const data = await api.getPlaylist(req.params.id);
    res.json(formatplaylist(data.body));
});

app.get('/album/:id', async (req, res) => {
    api.setAccessToken(token);
    const data = await api.getAlbum(req.params.id);
    res.json(formatalbum(data.body));
});

app.get('/yt/:id', (req, res) => {
    ytdl(`https://www.youtube.com/watch?v=${req.params.id}`, { filter: 'audioonly', quality: 'highestaudio' })
        .pipe(createWriteStream(`${req.params.id}.mp3`))
        .on('finish', () => res.download(`${req.params.id}.mp3`));
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

app.get('/me', async (req, res) => {
    api.setAccessToken(token);
    const data = await api.getMe();
    res.json({ name: data.body.display_name, image: data.body.images[0].url });
});

app.get('/usertrs', async (req, res) => {//liked tracks
    api.setAccessToken(token);
    const data = await api.getMySavedTracks({ limit: 50 });
    res.json(formatusertrs(data.body));
});

app.get('/userpls', async (req, res) => {//this has all the playlists(made + following)
    api.setAccessToken(token);
    const data = await api.getUserPlaylists({ limit: 50 });
    res.json(formatlikedpls(data.body));
});

app.get('/userals', async (req, res) => {
    api.setAccessToken(token);
    const data = await api.getMySavedAlbums({ limit: 50 });
    res.json(formatuserals(data.body));
});

app.listen(3000, () => console.log('app listening'));