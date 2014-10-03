function scorePullRequest(pull) {
  var create  = moment(pull.created_at),
      updated = moment(pull.updated_at);

  var delta = moment().utc().diff(updated, 'days'); 

  return delta;
}

var RopeburnHelp = React.createClass({
  render : function() {
    return (
      <div className="container">
        <h3>Setup Ropeburn</h3>
        <p>Ropeburn interfaces with GitHub, and requires a Personal Access Token so the extension can communicate with GitHub.</p>
        <h5>Getting Started with GitHub and Creating a Personal Access Token:</h5>
        <ul>
          <li>Sign up for GitHub here: <a href="https://github.com" target="_blank">github.com</a></li>
          <li>Once signed in Go to your profile page</li>
          <li>On the left sidebar click "Applications" 
            <ul>
              <li>Once there, click on "Generate New Token"</li>
              <li>On the next page you will prompted to enter a Token Description: i.e. "Rope Burn" 
                <ul>
                  <li>Select the scopes you wish to grant to this token. The default scopes allow you to interact with public and private repositories, user data, and gists</li>
                </ul>
              </li>
            </ul>
          </li>
          <li>You will now be redirected back to the "Applications" page where you will see your unique Personal Access Token</li>
          <li>Copy this token to your clipboard</li>
        </ul>
      </div>
    );
  }
});

var RopeburnPreferences = React.createClass({
  getInitialState: function() {
    return { orgs: [], available: {}, selectedOrg : '0' }
  },

  componentWillMount: function() {
    this.fetchOrganizations();
    this.loadReposForOrg('0');
  },

  toggleOrgFilter : function(e) {
    e.preventDefault();
    var org_id = e.target.getAttribute('data-id');
    this.loadReposForOrg(org_id);
    this.setState({ selectedOrg : org_id });
    return false;
  },

  render : function() {
    var selected = this.state.selectedOrg;
    var selectedRepos = this.props.repositories;

    var orgs = this.state.orgs.map(function(org) {
      var labelClass = selected == org.id ? 'label label-info' : 'label label-default';
      return (<a key={'org-' + org.id} className={labelClass} onClick={this.toggleOrgFilter} data-id={org.id} href="#">{org.login}</a>);
    }.bind(this));

    var availableRepos = (this.state.available[this.state.selectedOrg] || []).map(function(repo) {
      var classes = [ 'list-group-item' ];
      if ( selectedRepos.indexOf(repo.full_name) >= 0 ) {
        classes.push('list-group-item-info');
      }
      return (<a key={'repo-' + repo.id} href="#" data-repo={repo.full_name} onClick={this.toggleRepository} className={classes.join(' ')}>{repo.name}</a>);
    }.bind(this));

    return (
      <div>
        <h3>Preferences</h3>
        {orgs}
        <hr/>
        <div className="list-group">
          {availableRepos}
        </div>
      </div>
    )
  },

  loadReposForOrg: function(org_id) {
    var fetch_url = null;

    if ( org_id == '0' ) {
      fetch_url = this.props.github_base_url + 'user/repos';
    } else {
      var org;
      this.state.orgs.forEach(function(org_iter) {
        if ( org_iter.id == org_id ) {
          org = org_iter;
        }
      });

      if ( org ) {
        fetch_url = this.props.github_base_url + 'orgs/' + org.login + '/repos';
      }
    }

    if ( !fetch_url ) {
      return null;
    }

    this.fetchAllRepos(org_id, fetch_url);
  },

  fetchAllRepos : function(org_id, fetch_url, page) {
    var self = this;
    var req  = new XMLHttpRequest();
    var available = this.state.available;

    if ( !page ) {
      page = 1;
    }

    req.open("GET", fetch_url);
    req.setRequestHeader("Authorization", "Basic " + btoa(this.props.access_token + ":x-oauth-basic"));
    req.onload = function(e) {
      console.log(req.getResponseHeader('Link'));
      available[org_id] = JSON.parse(e.target.responseText);
      self.setState({ available: available });
    }

    req.send(null);
  },

  fetchOrganizations : function() {
    var self = this;
    var req = new XMLHttpRequest();
    req.open("GET", this.props.github_base_url + 'user/orgs');
    req.setRequestHeader("Authorization", "Basic " + btoa(this.props.access_token + ":x-oauth-basic"));
    req.onload = function(e) {
      var orgs = [ { id: 0, login: 'self' } ].concat(JSON.parse(e.target.responseText));
      self.setState({ orgs: orgs });
    }

    req.send(null);
  },

  toggleRepository : function(e) {
    e.preventDefault();

    var repo_name = e.target.getAttribute('data-repo');
    if ( this.props.repositories.indexOf(repo_name) >= 0 ) {
      this.removeRepository(repo_name);
    }
    else {
      this.addRepository(repo_name);
    }

    return false;
  },

  addRepository: function(repo) {
    this.props.addRepository(repo);
  },

  removeRepository: function(repo) {
    this.props.removeRepository(repo);
  }
});

var RopeburnIntro = React.createClass({
  saveSettings : function() {
    var access_token = this.refs.access_token.getDOMNode().value.trim();
    if ( access_token ) {
      this.props.setAccessToken(access_token);
    }
  },

  render : function() {
    return (
      <div id="introduction">
        <h3>Intro Window</h3>
        <form onSubmit={this.saveSettings}>
          <p>Enter your GitHub Personal Access Token</p>
          <input type="text" name="access_token" ref="access_token"/>
          <br/>
          <button>Next</button>
          <hr/>
          <p>
            <a href="#">Need help?</a>
          </p>
        </form>
      </div>
    );
  }
});

var PullRequest = React.createClass({
  openPR : function() {
    chrome.tabs.create({ url: this.props.pull.html_url });
  },

  render : function() {
    return (
      <div className="pullRequest row" onClick={this.openPR} target="_ropeburnPull">
        <div className="col-xs-2">
          <img src={this.props.pull.user.avatar_url} style={{ width:"32px" }}/>
        </div> 
        <div className="col-xs-7 title">
          {this.props.pull.title}
        </div>
        <div className="col-xs-3">
          <span className="label label-success">{this.props.pull.weightedScore}</span>
        </div>
      </div>
    );
  }
});

var RopeburnList = React.createClass({
  getInitialState: function() {
    return { pulls : [] };
  },

  componentWillMount: function() {
    this.listPullRequests().then(function(values) {
      this.setState({ pulls : this.analyzeOpenPulls(values) });
    }.bind(this));
  },

  render : function() {
    var pulls = this.state.pulls.slice(0, 5).map(function(pull) {
      return (<PullRequest pull={pull} key={pull.id}/>);
    });

    return (
      <div className="pullList">
        {pulls}
      </div>
    );
  },

  analyzeOpenPulls: function(pullsInRepos) {
    var sortedList = [],
        self = this;

    pullsInRepos.forEach(function(pulls) {
      pulls.forEach(function(pull) {
        pull.weightedScore = scorePullRequest(pull);
        sortedList.push(pull);
      });
    });

    return sortedList.sort(function(a, b) { return b.score - a.score });
  },


  handlePRResponse : function(resolve, reject) {
    var resolveCB = resolve; resolve = null;
    var rejectCB  = reject; reject = null;

    return function(e) {
      try {
        data = JSON.parse(e.target.responseText);
        resolveCB(data);
      } catch(e) {
        rejectCB(e);
      }
    }
  },

  listPullRequest : function(repo) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();
      req.open("GET", this.props.github_base_url + 'repos/' + repo + '/pulls');
      req.setRequestHeader("Authorization", "Basic " + btoa(this.props.access_token + ":x-oauth-basic"));
      req.onload = this.handlePRResponse.call(this, resolve, reject);
      req.send(null);
    }.bind(this));
  },

  listPullRequests : function() {
    return Promise.all( this.props.repositories.map(function(repo) { return this.listPullRequest(repo); }.bind(this)) );
  }

});

var Ropeburn = React.createClass({
  getInitialState: function() {
    var view = 'Intro';

    if ( this.props.access_token && this.props.repositories.length > 0 ) {
      view = 'List';
    }
    else if ( this.props.access_token ) {
      view = 'Preferences';
    }

    return {
      access_token  : this.props.access_token,
      repositories  : this.props.repositories || [],
      pull_requests : [],
      activeView    : view
    };
  },

  render: function() {
    var viewName = this.state.activeView,
        menu = '';

    if ( viewName == 'List' ) {
      view = (<RopeburnList access_token={this.state.access_token} repositories={this.state.repositories} github_base_url={this.props.github_base_url} setActiveView={this.setActiveView}/>);
      menu = (
          <div className="col-xs-3" onClick={this.setViewCallback('Preferences')}>
            <i className="fa fa-cog"></i>
          </div>
      );
    }
    else if ( viewName == 'Preferences' ) {
      view = (<RopeburnPreferences access_token={this.state.access_token} repositories={this.state.repositories} github_base_url={this.props.github_base_url} setActiveView={this.setActiveView} addRepository={this.addRepository} removeRepository={this.removeRepository}/>);
      menu = (
          <div className="col-xs-3" onClick={this.setViewCallback('List')}>
            <i className="fa fa-close"></i>
          </div>
      );
    }
    else if ( viewName == 'Help' ) {
      view = (<RopeburnHelp setActiveView={this.setActiveView}/>);
      menu = (
          <div className="col-xs-3" onClick={this.setViewCallback('Intro')}>
            <i className="fa fa-close"></i>
          </div>
      );
    }
    else {
      view = (<RopeburnIntro setAccessToken={this.setAccessToken} setActiveView={this.setActiveView}/>);
    }

    return (
      <div>
        <div className="header row">
          <div className="col-xs-3">
            <img src="ropeburn.jpg" style={{ width: "48px" }}/>
          </div>
          <div className="col-xs-6 text-center">
            Ropeburn
          </div>
          {menu}
        </div>
        {view}
      </div>
    );
  },

  setViewCallback: function(view) {
    var v = view; view = null;
    return function() {
      console.log('setting active view to ' + v);
      this.setActiveView(v);
    }.bind(this);
  },

  setActiveView : function(view) {
    this.setState({ activeView: view });
  },

  setAccessToken: function(token) {
    chrome.storage.sync.set({'access_token': token}, function() {
      //console.log('set access token');
    });
    this.setState({ token: token });
  },

  addRepository : function(repo) {
    var repos = this.state.repositories;
    repos.push(repo);
    chrome.storage.sync.set({'repositories': repos});
    this.setState({ repositories: repos });
  },

  removeRepository : function(repo) {
    var repos = [];
    this.state.repositories.forEach(function(r) {
      if ( r != repo ) {
        repos.push(r);
      }
    });

    chrome.storage.sync.set({'repositories': repos});
    this.setState({ repositories: repos });
  }
});


document.addEventListener('DOMContentLoaded', function() {
  var repositories = [];

  chrome.storage.sync.get('access_token', function(value) {
    var token = value && value.access_token || null;
    chrome.storage.sync.get('repositories', function(repo_value) {
      if ( repo_value && repo_value.repositories.length > 0 ) {
        repositories = repo_value.repositories;
      }
      React.renderComponent(
        <Ropeburn
          access_token={token}
          github_base_url='https://api.github.com/'
          repositories={repositories}
        />,
        document.getElementById('ropeburn')
      );
    });
  });
});
