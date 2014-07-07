(function($, _, io, Backbone, config) {
  var port = (config && config.port) || 3000;
  var socket = io.connect('http://localhost:' + port);
  var isConnected = false;
  socket.on('connect', function() {
    isConnected = true;
    if (currentChannel) {
      socket.emit('joinChannel', this._id);
    }
  });
  socket.on('disconnect', function() {
    isConnected = false;
  });

  var currentChannel = null;
  var currentPage = null;

  var Router = Backbone.Router.extend({
    routes: {
      "": "index",
      "channel/:id": "channel"
    },
    index: function() {

      currentPage = new IndexView();
    },
    channel: function(id) {
      currentPage = new ChannelView(null, id);
    }
  });
  var router = new Router();

  var IndexView = Backbone.View.extend({
    el: '#main',
    events: {
      'click #createNewChannelBtn': 'createNewChannel'
    },
    template: _.template('<a href="#" id="createNewChannelBtn" class="btn btn-primary btn-block btn-lg">Start live coding</a>'),
    initialize: function() {
      currentChannel = null;
      this.render();
    },
    render: function(){
      this.$el.empty().html(this.template());
    },
    createNewChannel: function(event) {
      socket.emit('createNewChannel');
      return false;
    }
  });

  var ChannelView = Backbone.View.extend({
    el: '#main',
    _id: null,
    _templates: {
      rootContainer: _.template('<div class="row"></div>'),
      container: _.template('<div class="col-md-12"></div>'),
      command: _.template('<code>$ gulp -w &quot;./your/edit/path/**/*&quot; -c &quot;<%- channelID %>&quot;</code>'),
      left: _.template('<div></div>'),
      file: _.template('<pre class="language-<%- language %>"><code class="language-<%- language %>"><%- data %></code></pre>'),
      tabContainer: _.template('<ul class="nav nav-tabs" role="tablist"></ul>'),
      tabPainContainer: _.template('<div class="tab-content"></div>'),
      tab: _.template('<li<% if(isActive){ %> class="active"<% } %>><a href="#fileTab-<%- fileID %>" role="tab" data-toggle="tab"><%- fileName %></a></li>'),
      pain: _.template('<div class="tab-pane <% if(isActive){ %> active<% } %>" id="fileTab-<%- fileID %>"></div>')
    },
    $root: null,
    $container: null,
    $command: null,
    $tabContainer: null,
    $tabPainContainer: null,
    $content: null,
    files: null,
    initialize: function(el, id) {
      this._id = id;
      this.files = {};
      currentChannel = this._id;
      socket.emit('joinChannel', this._id);
      this.render();
      socket.on('addSnapshot', $.proxy(this.addSnapshot, this));
      socket.on('addPatch', $.proxy(this.addPatch, this));
      socket.on('currentFiles', $.proxy(this.refreshFiles, this));
      if (isConnected) {
        socket.emit('getCurrentFiles', this._id);
      } else {
        socket.on('connect', $.proxy(function() {
          socket.emit('getCurrentFiles', this._id);
        }, this));
      }
    },
    render: function() {
      this.$el.empty();
      this.$root = $(this._templates.rootContainer());
      this.$container = $(this._templates.container());
      this.$root.append(this.$container);
      this.$command = $(this._templates.command({channelID: this._id}));
      this.$container.append(this.$command);
      this.$tabContainer = $(this._templates.tabContainer());
      this.$tabPainContainer = $(this._templates.tabPainContainer());
      this.$container.append(this.$tabContainer);
      this.$container.append(this.$tabPainContainer);
      this.$el.append(this.$root);
    },
    refreshFiles: function(files) {
      _.each(files, $.proxy(function(fileData, filePath) {
        this.addSnapshot(fileData);
      }, this));
    },
    addSnapshot: function(fileData) {
      console.log(fileData);
      var fileName = fileData.name;
      var type = fileData.extension;
      var fileID = fileData.id;
      var tabExists = !!this.files[fileID];
      this.files[fileID] = {
        fileName: fileName,
        content: fileData.data
      };
      this.$tabContainer.find('li.active').removeClass('active');
      this.$tabPainContainer.find('div.tab-pane.active').removeClass('active');
      if (!tabExists) {
        this.$tabContainer.append($(this._templates.tab({isActive: true, fileID: fileID, fileName: fileName})));
        this.$tabPainContainer.append($(this._templates.pain({isActive: true, fileID: fileID})));
      }
      var language;
      switch (type) {
        case 'js':
          language = 'javascript';
          break;
        case 'coffee':
          language = 'coffeescript';
          break;
        case 'sh':
          language = 'bash';
          break;
        case 'py':
          language = 'python';
          break;
        case 'rb':
          language = 'ruby';
          break;
        default:
          language = type;
          break;
      }
      var $code = $(this._templates.file({data: fileData.data, language: language}));
      var $pain = $('#fileTab-' + fileID);
      $pain.empty().append($code);
      $pain.addClass('active');
      this.$tabContainer.find('li a[href="#fileTab-' + fileID + '"]').parents('li').addClass('active');
      Prism.highlightElement($code[0]);
    },
    addPatch: function(fileData) {
      console.log('patch', fileData);
    }
  });

  socket.on('channelJoined', function(msg) {
    console.log(msg);
  });
  socket.on('channelCreated', function(channelID) {
    console.log('channelCreated', channelID);
    router.navigate("channel/" + channelID, {trigger: true, replace: true});
  });

  $(function() {
    Backbone.history.start({pushState: true});
    $('#logoBanner').on('click', function(){
      router.navigate("/", {trigger: true, replace: true});
      return false;
    })
  });
})(jQuery, _, io, Backbone, AppConfig);