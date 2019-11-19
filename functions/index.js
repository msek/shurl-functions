// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require("firebase-functions");

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

const dns = require("dns");

const shortestAvailableUrl = previousUrl => {
  splitUrl = previousUrl.split("");
  lastLetter = splitUrl[splitUrl.length - 1];

  if (lastLetter === "z") {
    splitUrl.push("0");
  } else if (lastLetter === "9") {
    splitUrl[splitUrl.length - 1] = "a";
  } else {
    splitUrl.pop();
    splitUrl.push(String.fromCharCode(lastLetter.charCodeAt(0) + 1));
  }

  return splitUrl.join("");
};

exports.getUrl = functions.https.onRequest((req, res) => {
  const { shortUrl } = req.body;

  // check if it's in database already
  db.collection("urls")
    .where("shortUrl", "==", shortUrl)
    .limit(1)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        return res.status(404).send({ error: "URL not found" });
      }
      return res.status(200).send({
        url: snapshot.docs[0].data().url
      });
    })
    .catch(err => {
      console.log("Error getting URL", err);
      return res.status(400).send({
        error: "Error getting URL"
      });
    });
});

exports.addUrl = functions.https.onRequest((req, res) => {
  let testUrl;
  let { sourceUrl } = req.body;

  // check if input value is a valid url
  try {
    testUrl = new URL(sourceUrl);
  } catch (err) {
    return res.status(400).send({ error: "Not a valid URL!" });
  }

  // check if URL is real
  dns.lookup(testUrl.hostname, err => {
    if (err) {
      return res.status(404).send({ error: "URL not found" });
    }

    // check if it's in database already
    db.collection("urls")
      .where("url", "==", sourceUrl)
      .limit(1)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          // get latest shortened URL document
          db.collection("urls")
            .orderBy("id", "desc")
            .limit(1)
            .get()
            .then(snapshot => {
              const latestShortUrlDoc = snapshot.docs[0].data();
              const newShortUrl = {
                id: latestShortUrlDoc.id + 1,
                shortUrl: shortestAvailableUrl(latestShortUrlDoc.shortUrl),
                url: sourceUrl
              };
              db.collection("urls")
                .add(newShortUrl)
                .then(ref => {
                  console.log("Added document " + ref.id);
                  return res.status(200).send({ created: "created" });
                });
            });
          return;
        }
        return res
          .status(200)
          .send({ shortUrl: snapshot.docs[0].data().shortUrl });
      })
      .catch(err => {
        console.log("Error getting documents", err);
        return res.status(400).send({ error: "Error getting documents" });
      });
  });
});
