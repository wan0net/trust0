/*
Copyright 2021 Yarmo Mackenbach

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import * as aspe from './aspe.js'
import * as openpgp from './openpgp.js'
import * as dns from './dns.js'
import * as irc from './irc.js'
import * as xmpp from './xmpp.js'
import * as matrix from './matrix.js'
import * as telegram from './telegram.js'
import * as twitter from './twitter.js'
import * as reddit from './reddit.js'
import * as liberapay from './liberapay.js'
import * as lichess from './lichess.js'
import * as hackernews from './hackernews.js'
import * as lobsters from './lobsters.js'
import * as forem from './forem.js'
import * as forgejo from './forgejo.js'
import * as gitea from './gitea.js'
import * as gitlab from './gitlab.js'
import * as github from './github.js'
import * as activitypub from './activitypub.js'
import * as discourse from './discourse.js'
import * as owncast from './owncast.js'
import * as stackexchange from './stackexchange.js'
import * as keybase from './keybase.js'
import * as opencollective from './opencollective.js'
import * as orcid from './orcid.js'
import * as pronounscc from './pronounscc.js'
import * as discord from './discord.js'
import * as bsky from './bsky.js'
import * as sourcehut from './sourcehut.js'
import * as pronounspage from './pronounspage.js'

const _data = {
  aspe,
  openpgp,
  dns,
  irc,
  xmpp,
  matrix,
  telegram,
  twitter,
  reddit,
  liberapay,
  lichess,
  hackernews,
  lobsters,
  forem,
  forgejo,
  gitea,
  gitlab,
  github,
  activitypub,
  discourse,
  owncast,
  stackexchange,
  keybase,
  opencollective,
  orcid,
  pronounscc,
  pronounspage,
  discord,
  bsky,
  sourcehut
}

export const list = Object.keys(_data)
export { _data as data }
