/**
 * @fileoverview Scene controller for entry.
 */
'use strict';

/**
 * Class for a scene controller.
 * This have view for scenes.
 * @constructor
 */
Entry.Scene = function() {
    var that = this;
    this.scenes_ = [];
    this.selectedScene = null;
    this.maxCount = 20;
    $(window).on('resize', (function(e) {
        that.resize();
    }));

    that.disposeEvent =
        Entry.disposeEvent.attach(this, function(e) {
            var elem = document.activeElement;
            if (elem && elem !== e.target &&
                $(elem).hasClass('entrySceneFieldWorkspace')) {
                elem.blur();
            }
        });
};

/**
 * Control bar view generator.
 * @param {!Element} sceneView sceneView from Entry.
 * @param {?string} option for choose type of view.
 */
Entry.Scene.prototype.generateView = function(sceneView, option) {
    /** @type {!Element} */
    var that = this;
    this.view_ = sceneView;
    this.view_.addClass('entryScene');
    if (!option || option == 'workspace') {
        this.view_.addClass('entrySceneWorkspace');

        $(this.view_).on('mousedown', function (e) {
            var offset = $(this).offset();
            var $window = $(window);
            var x = e.pageX - offset.left + $window.scrollLeft();
            var y = e.pageY - offset.top + $window.scrollTop();
            y = 40 - y;
            var slope = -40/55;
            var selectedScene = that.selectedScene;
            var selectedLeft = $(selectedScene.view).find('.entrySceneRemoveButtonCoverWorkspace').offset().left;
            if (x < selectedLeft || x > selectedLeft + 55) return;

            x -= selectedLeft;
            var ret = 40 + slope*x;

            if (y > ret) {
                var nextScene = that.getNextScene();
                if (nextScene) {
                   var $sceneView = $(nextScene.view);
                   $(document).trigger('mouseup');
                   $sceneView.trigger('mousedown');
                }
            }
        });

        var listView = Entry.createElement('ul');
        listView.addClass('entrySceneListWorkspace');

        if (Entry.sceneEditable) {
            if ($) {
                $(listView).sortable({
                    start: function(event, ui) {
                        ui.item.data('start_pos', ui.item.index());
                        var clone = $(ui.item[0]).clone(true);
                    },
                    stop: function(event, ui){
                        var start = ui.item.data('start_pos');
                        var end = ui.item.index();
                        Entry.scene.moveScene(start, end);
                    },
                    axis: 'x',
                    tolerance: "pointer"
                });
            }
        }

        this.view_.appendChild(listView);
        this.listView_ = listView;
        if (Entry.sceneEditable) {
            var addButton = Entry.createElement('span');
            addButton.addClass('entrySceneElementWorkspace');
            addButton.addClass('entrySceneAddButtonWorkspace');
            addButton.bindOnClick(function (e) {
                if (Entry.engine.isState('run'))
                    return;
                Entry.scene.addScene();
            });
            this.view_.appendChild(addButton);
            this.addButton_ = addButton;
        }
    }
};

/**
 * generate li element for scene
 * @param {!scene model} scene
 */
Entry.Scene.prototype.generateElement = function(scene) {
    var that = this;
    var viewTemplate = Entry.createElement('li', scene.id);
    var fragment = document.createDocumentFragment('div');
    fragment.appendChild(viewTemplate);
    var className = '';
    className += 'entrySceneElementWorkspace';
    className += ' entrySceneButtonWorkspace';
    className += ' minValue';
    viewTemplate.addClass(className);
    $(viewTemplate).on('mousedown', function(e){
        if (Entry.engine.isState('run')) {
            e.preventDefault();
            return;
        }
        Entry.scene.selectScene(scene);
    });
    var nameField = Entry.createElement('input');
    nameField.addClass('entrySceneFieldWorkspace');
    nameField.value = scene.name;

    if (!Entry.sceneEditable)
        nameField.disabled = 'disabled';

    var sceneLeft = Entry.createElement('span');
    sceneLeft.addClass('entrySceneLeftWorkspace');
    viewTemplate.appendChild(sceneLeft);

    var divide = Entry.createElement('span');
    divide.addClass('entrySceneInputCover');
    viewTemplate.appendChild(divide);
    scene.inputWrapper = divide;

    nameField.onkeyup = function (e) {
        var code = e.keyCode;
        if (Entry.isArrowOrBackspace(code))
            return;

        scene.name = this.value;
        if (code == 13)
            this.blur();
        if (this.value.length > 10) {
            this.value = this.value.substring(0,10);
            scene.name = this.value;
            this.blur();
        }
        setTimeout(function() {
            that.resize();
        }, 0);
    };
    nameField.onblur = function (e) {
        nameField.value = this.value;
        scene.name = this.value;
        that.resize();
    };
    divide.appendChild(nameField);
    var removeButtonCover = Entry.createElement('span');
    removeButtonCover.addClass('entrySceneRemoveButtonCoverWorkspace');
    viewTemplate.appendChild(removeButtonCover);
    if (Entry.sceneEditable) {
        var removeButton = Entry.createElement('button');
        removeButton.addClass('entrySceneRemoveButtonWorkspace');
        removeButton.scene = scene;
        removeButton.bindOnClick(function (e) {
            e.stopPropagation();
            if (Entry.engine.isState('run'))
                return;
            var a = confirm(Lang.Workspace.will_you_delete_scene);
            if (a)
                Entry.scene.removeScene(this.scene);
            return;
        });
        removeButtonCover.appendChild(removeButton);
    }

    Entry.Utils.disableContextmenu(viewTemplate);

    $(viewTemplate).on('contextmenu', function() {
        var options = [
            {
                text: Lang.Workspace.duplicate_scene,
                enable: Entry.engine.isState('stop') && !this.isMax(),
                callback: function(){
                    Entry.scene.cloneScene(scene);
                }
            }
        ];
        Entry.ContextMenu.show(options, 'workspace-contextmenu');
    }.bind(this));

    scene.view = viewTemplate;

    return viewTemplate;
};

Entry.Scene.prototype.updateView = function() {
    if (!Entry.type || Entry.type == 'workspace') {
        var view = this.listView_;
        var renderedCount = $(view).children().length;
        for (var i = renderedCount; i < this.getScenes().length; i++)
            view.appendChild(this.getScenes()[i].view);

        if (this.addButton_) {
            var length = this.getScenes().length;
            if (!this.isMax())
                this.addButton_.removeClass('entryRemove');
            else
                this.addButton_.addClass('entryRemove');
        }
    }
    this.resize();
};

/**
 * add scenes
 * @param {Array<scene model>} scenes
 */
Entry.Scene.prototype.addScenes = function(scenes) {
    this.scenes_ = scenes;
    if (!scenes || scenes.length === 0) {
        this.scenes_ = [];
        this.scenes_.push(this.createScene());
    } else {
        for (var i=0,len=scenes.length; i<len; i++)
            this.generateElement(scenes[i]);
    }

    this.selectScene(this.getScenes()[0]);
};
/**
 * add scenes to this.scenes_
 * @param {scene model} scene
 */
Entry.Scene.prototype.addScene = function(scene, index) {
    if (scene === undefined)
        scene = this.createScene();

    if (!scene.view)
        this.generateElement(scene);

    if (!index && typeof index != 'number')
        this.getScenes().push(scene);
    else
        this.getScenes().splice(index, 0, scene);

    Entry.stage.objectContainers.push(Entry.stage.createObjectContainer(scene));
    this.selectScene(scene);
    this.updateView();
    return scene;
};

/**
 * remove scene from this.scenes_
 * @param {!scene model} scene
 */
Entry.Scene.prototype.removeScene = function(scene) {
    if (this.getScenes().length <=1) {
        Entry.toast.alert(
            Lang.Msgs.runtime_error,
            Lang.Workspace.Scene_delete_error,
            false
        );
        return;
    }

    var index = this.getScenes().indexOf(this.getSceneById(scene.id));

    this.getScenes().splice(index, 1);
    var objects = Entry.container.getSceneObjects(scene);

    for (var i=0; i<objects.length; i++)
        Entry.container.removeObject(objects[i]);
    Entry.stage.removeObjectContainer(scene);
    $(scene.view).remove();
    this.selectScene();
};

/**
 * select scene
 * @param {scene model} scene
 */
Entry.Scene.prototype.selectScene = function(scene) {
    scene = scene || this.getScenes()[0];
    if (this.selectedScene && (this.selectedScene.id == scene.id))
        return;

    if (Entry.engine.isState('run'))
        Entry.container.resetSceneDuringRun();

    var prevSelected = this.selectedScene;
    if (prevSelected) {
        var prevSelectedView = prevSelected.view;
        prevSelectedView.removeClass('selectedScene');
        var elem = document.activeElement;

        if ($(elem).hasClass('entrySceneFieldWorkspace'))
            elem.blur();
    }

    this.selectedScene = scene;
    scene.view.addClass('selectedScene');
    Entry.container.setCurrentObjects();
    if (Entry.stage.objectContainers &&
        Entry.stage.objectContainers.length !== 0)
        Entry.stage.selectObjectContainer(scene);

    var targetObject = Entry.container.getCurrentObjects()[0];
    if (targetObject && Entry.type != 'minimize') {
        Entry.container.selectObject(targetObject.id);
        Entry.playground.refreshPlayground();
    }
    else {
        if(Entry.isTextMode) {
            var workspace = Entry.getMainWS();
            if(workspace && workspace.vimBoard) {
                var sObject = workspace.vimBoard._currentObject;
                var sScene = workspace.vimBoard._currentScene;
                var parser = workspace.vimBoard._parser;
                try {
                    if(scene.id != sScene.id)
                        workspace._syncTextCode();
                }
                catch(e) {}
                if(parser._onError) {
                    Entry.container.selectObject(sObject.id, true);
                    return;
                }
            }
            workspace && workspace.vimBoard && workspace.vimBoard.clearText();
        }

        Entry.stage.selectObject(null);
        Entry.playground.flushPlayground();
        Entry.variableContainer.updateList();
    }

    if (!Entry.container.listView_)
        Entry.stage.sortZorder();
    Entry.container.updateListView();
    this.updateView();
    Entry.requestUpdate = true;
};

/**
 * convert this scenes data to JSON.
 * @return {JSON}
 */
Entry.Scene.prototype.toJSON = function() {
    var json = [];
    var length = this.getScenes().length;
    for (var i = 0; i<length; i++) {
        var scene = this.getScenes()[i];
        var view = scene.view;
        var inputWrapper = scene.inputWrapper;
        delete scene.view;
        delete scene.inputWrapper;
        json.push(JSON.parse(JSON.stringify(scene)));
        scene.view = view;
        scene.inputWrapper = inputWrapper;
    }
    return json;
};


/**
 * Move scene in this.scenes_
 * this method is for sortable
 * @param {!number} start
 * @param {!number} end
 */
Entry.Scene.prototype.moveScene = function(start, end) {
    this.getScenes().splice(
        end, 0, this.getScenes().splice(start, 1)[0]);
    Entry.container.updateObjectsOrder();
    Entry.stage.sortZorder();
    //style properties are not removed sometimes
    $('.entrySceneElementWorkspace').removeAttr('style');
};

/**
 * get scene by scene id
 * @param {!String} sceneId
 * @return {scene modal}
 */
Entry.Scene.prototype.getSceneById = function(sceneId) {
    var scenes = this.getScenes();
    for (var i=0; i<scenes.length; i++) {
        if (scenes[i].id == sceneId)
            return scenes[i];
    }
    return false;
};

/**
 * @return {Array<Entry scene>}
 */
Entry.Scene.prototype.getScenes = function() {
    return this.scenes_;
};


/**
 * remember selectedScene before start
 * in order to reset when stopped
 */
Entry.Scene.prototype.takeStartSceneSnapshot = function() {
    this.sceneBeforeRun = this.selectedScene;
};

/**
 * select selectedScene before start
 * before run start
 */
Entry.Scene.prototype.loadStartSceneSnapshot = function() {
    this.selectScene(this.sceneBeforeRun);
    this.sceneBeforeRun = null;
};
/**
 * create scene
 * @return {scene modal} scene
 */
Entry.Scene.prototype.createScene = function() {
    var scene = {
        name: Lang.Blocks.SCENE + ' ' + (this.getScenes().length + 1),
        id: Entry.generateHash()
    };

    this.generateElement(scene);
    return scene;
};


/**
 * clone scene by context menu
 * @param {!scene model} scene
 */
Entry.Scene.prototype.cloneScene = function(scene) {
    if (this.isMax()) {
        Entry.toast.alert(
            Lang.Msgs.runtime_error,
            Lang.Workspace.Scene_add_error,
            false
        );
        return;
    }

    var clonedScene = {
        name: (Lang.Workspace.cloned_scene + scene.name).substring(0, 10),
        id: Entry.generateHash()
    };

    this.generateElement(clonedScene);
    this.addScene(clonedScene);

    var objects = Entry.container.getSceneObjects(scene);

    try {
        this.isSceneCloning = true;
        for (var i=objects.length-1; i>=0; i--)
            Entry.container.addCloneObject(objects[i], clonedScene.id);
        this._focusSceneNameField(clonedScene);
        this.isSceneCloning = false;
    } catch(e) {}
};

/**
 * resize html element by window size
 * @param {!scene model} scene
 */
Entry.Scene.prototype.resize = function() {
    var scenes = this.getScenes();
    var selectedScene = this.selectedScene;
    var addButton = this.addButton_;
    var firstScene = scenes[0];

    if (scenes.length === 0 || !firstScene) return;
    var startPos = $(firstScene.view).offset().left;
    var marginLeft = parseFloat($(selectedScene.view).css('margin-left'));
    var totalWidth = Math.floor($(this.view_).width() - startPos - 5);
    var LEFT_MARGIN = -40;

    var normWidth = startPos + 15;
    var diff = 0;
    for (var i in scenes) {
        var scene = scenes[i];
        var view = scene.view;
        view.addClass('minValue');
        view = $(view);

        var width = parseFloat(Entry.computeInputWidth(scene.name));
        var adjusted =  width*10/9;
        if (scene === this.selectedScene)
            diff = adjusted - width;
        $(scene.inputWrapper).width(adjusted + 'px');
        normWidth += view.width() + LEFT_MARGIN;
    }

    if (normWidth > totalWidth) align();

    function align() {
        var dummyWidth = 30.5;
        var len = scenes.length - 1;
        totalWidth = totalWidth - Math.round($(selectedScene.view).width())
                        - dummyWidth*len - diff;
        var fieldWidth = Math.floor(totalWidth/len);
        for (i in scenes) {
            scene = scenes[i];
            if (selectedScene.id != scene.id) {
                scene.view.removeClass('minValue');
                $(scene.inputWrapper).width(fieldWidth);
            } else scene.view.addClass('minValue');
        }
    }
};

Entry.Scene.prototype.getNextScene = function() {
    var scenes = this.getScenes();
    return scenes[scenes.indexOf(this.selectedScene) + 1];
};

Entry.Scene.prototype.isMax = function() {
    return this.scenes_.length >= this.maxCount;
};

Entry.Scene.prototype._focusSceneNameField = function(scene) {
    var input = $(scene.view).find('input');
    input && input.focus && input.focus();
};
