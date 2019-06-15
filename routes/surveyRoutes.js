const _ = require('lodash');
const Path = require('path-parser').default;
const { URL } = require('url');
const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');
const requireCredits = require('../middlewares/requireCredits');
const Mailer = require('../services/mailer');
const surveyTemplate = require('../services/emailTemplate/surveyTemplate');

const Survey = mongoose.model('surveys');

module.exports = app => {
  // thank you page after completing our sent survey
  app.get('/api/surveys/thanks', (req, res) => {
    res.send('Thanks for voting!');
  });

  // to store data from webhooks
  app.post('/api/surveys/webhooks', (req, res) => {
    const events = _.map(req.body, ({email, url}) => {
      const pathname = new URL(url).pathname;
      const p = new Path('/api/surveys/:surveyId/:choice');
      const match = p.test(pathname);
      if (match) {
        return { email, surveyId: match.surveyId, choice: match.choice };
      }
    });
    const compactEvents = _.compact(events);
    const uniqueEvents = _.uniqBy(compactEvents, 'emails', 'surveyId');

    console.log(uniqueEvents);
  });

  app.post('/api/surveys', requireLogin, requireCredits, async (req, res) => {
    // to create surveys
    const { title, subject, body, recipients } = req.body;

    const survey = new Survey({
      title,
      subject,
      body,
      recipients: recipients.split(',').map(email => ({ email: email.trim() })),
      _user: req.user.id,
      dateSent: Date.now()
    });

    // to send email of survey
    const mailer = new Mailer(survey, surveyTemplate(survey));

    try {
      await mailer.send();
      await survey.save();
      req.user.credits -= 1;
      const user = await req.user.save();

      res.send(user);
    } catch (err) {
      res.status(422).send(err);
    }
  });
};
