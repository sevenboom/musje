var musje = {};

if (typeof exports !== 'undefined') {
  exports = musje;
}

(function (musje) {
  'use strict';

  function isObject(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  }

  var objEach =
  musje.objEach = function (obj, cb) {
    if (isObject(obj)) {
      Object.keys(obj).forEach(function (key) {
        cb(obj[key], key);
      });
    }
  };

  musje.extend = function(obj, ext) {
    objEach(ext, function (val, key) { obj[key] = val; });
    return obj;
  };

  musje.near = function (a, b) {
    return Math.abs(a - b) < 0.00001;
  };

}(musje));

/* global musje */

(function (musje) {
  'use strict';

  var
    defineProperty = Object.defineProperty,
    keys = Object.keys,
    objEach = musje.objEach,
    extend = musje.extend;

  function defaultValue(model, $ref) {
    var tmp = $ref.split('/'), category = tmp[1], schemaName = tmp[2];
    return model[category] && model[category][schemaName] &&
           model[category][schemaName].default;
  }

  function makeObjectProperty(namespace, obj, propName, type) {
    var
      varName = '_' + propName,
      Constructor = namespace[type];

    if (!Constructor) { throw new Error('Undefined type: ' + type); }

    defineProperty(obj, propName, {
      get: function () {
        if (this[varName] === undefined) {
          this[varName] = new Constructor();
        }
        return this[varName];
      },
      set: function (v) { this[varName] = new Constructor(v); }
    });
  }

  function defineClass(namespace, model, category, type) {
    var
      Constructor = namespace[type] = function (obj) { extend(this, obj); },
      proto = Constructor.prototype,
      propNames = [];

    proto.$name = type;

    objEach(model[category][type], function (descriptor, propName) {
      var defaultVal, objName;

      // ES5 accessor property
      // -----------------------------------------------------------
      if (descriptor.get || descriptor.set) {
        defineProperty(proto, propName, descriptor);

      // Method
      // -----------------------------------------------------------
      } else if (typeof descriptor === 'function') {
        proto[propName] = descriptor;

      // Default value of primitive types
      // -----------------------------------------------------------
      } else if (descriptor.default !== undefined) {
        proto[propName] = descriptor.default;
        propNames.push(propName);

      // Schema reference
      // -----------------------------------------------------------
      } else if (descriptor.$ref) {
        defaultVal = defaultValue(model, descriptor.$ref);
        objName = descriptor.$ref.split('/')[2];
        if (defaultVal !== undefined) {
          proto[propName] = defaultVal;
        } else if (objName) {
          makeObjectProperty(namespace, proto, propName, objName);
        }
        propNames.push(propName);
      }
    });



    if (category === 'elements') {
      proto.toJSON = function () {
        var result = {},
          inner = result[this.$name] = {},
          i, propName;
        for (i = 0; i < propNames.length; i++) {
          propName = propNames[i];
          inner[propName] = this[propName];
        }
        return result;
      };
    } else {
      proto.toJSON = function () {
        var result = {}, i, propName;
        for (i = 0; i < propNames.length; i++) {
          propName = propNames[i];
          result[propName] = this[propName];
        }
        return result;
      };
    }
  }

  function makeSimpleClass(model, type) {
    var
      Constructor = function (val) { this.value = val; },
      proto = Constructor.prototype,
      defaultValue = model.elements[type].default;

    proto.$name = type;

    objEach(model.elements[type], function (descriptor, propName) {

      if (descriptor.default !== undefined) {
        proto.value = descriptor.default;

      // Method
      } else if (typeof descriptor === 'function') {
        proto[propName] = descriptor;
      }
    });

    proto.toJSON = function () {
      var result = {};
      result[type] = this.value;
      return result;
    };

    return Constructor;
  }


  // @constructor ClassMaker
  // Makes classes from the model and stores them in the namespace.
  var makeClasses = musje.makeClasses = function (namespace, model) {

    // Make array classes
    // ------------------------------------------------------------
    objEach(model.arrays, function (descriptor, type) {
      if (Array.isArray(descriptor)) {
        namespace[type] = makeClasses.ArrayOfHetroObjects(namespace);
      } else if (descriptor.$ref) {
        namespace[type] = makeClasses.ArrayOfHomoObjects(namespace,
                                        descriptor.$ref.split('/')[2]);
      } else {
        namespace[type] = makeClasses.ArrayOfPrimitives();
      }
    });

    // Make object classes
    // ------------------------------------------------------------
    keys(model.objects).forEach(function (type) {
      defineClass(namespace, model, 'objects', type);
    });

    // Make element classes
    // ------------------------------------------------------------
    objEach(model.elements, function (descriptor, type) {
      if (descriptor.type) {
        namespace[type] = makeSimpleClass(model, type);
      } else {
        defineClass(namespace, model, 'elements', type);
      }
    });

    // Make root class
    // ------------------------------------------------------------
    var rootName = keys(model.root)[0];
    defineClass(namespace, model,'root', rootName);
    namespace[rootName].prototype.stringify = function (replacer, space) {
      return JSON.stringify(this, replacer, space);
    };
  };

}(musje));

/* global musje */

(function (makeClasses) {
  'use strict';

  var
    slice = Array.prototype.slice,
    push = Array.prototype.push,
    keys = Object.keys;

  function camel(str) {
    return str.charAt(0).toUpperCase() + str.substr(1);
  }

  // The array construtors are not *real* constructors.

  makeClasses.ArrayOfHetroObjects = function (namespace) {

    // Overwrite array push function with applying the child constructor.
    function ArrayOfHetroObjects(a) {
      var arr = [];

      arr.push = function () {
        slice.call(arguments).forEach(function (item) {
          var
            propName = keys(item)[0],
            ItemConstructor = namespace[camel(propName)];

          push.call(arr, new ItemConstructor(item[propName]));
        });
      };

      arr.push.apply(arr, a);
      return arr;
    }
    return ArrayOfHetroObjects;
  };

  makeClasses.ArrayOfHomoObjects = function (namespace, type) {

    function ArrayOfHomoObjects(a) {
      var arr = [];
      arr.push = function () {
        slice.call(arguments).forEach(function (item) {
          push.call(arr, new namespace[type](item));
        });
      };
      arr.push.apply(arr, a);
      return arr;
    }

    return ArrayOfHomoObjects;
  };

  makeClasses.ArrayOfPrimitives = function () {

    function ArrayOfPrimitives(a) {
      var arr = [];
      arr.push.apply(arr, a);
      return arr;
    }

    return ArrayOfPrimitives;
  };

}(musje.makeClasses));

/* global musje */

(function (musje) {
  'use strict';

  var
    extend = musje.extend,
    objEach = musje.objEach;

  // TODO: To be implemented without dependency...
  function objDeepClone(obj) {
    return angular.copy(obj);
  }

  function noAccessor(obj) {
    var result = objDeepClone(obj);
    objEach(result, function (val, key) {
      if (val.get || val.set) { delete result[key]; }
    });
    return result;
  }

  musje.makeJSONSchema = function (model) {
    var schema = extend({
      $schema: 'http://json-schema.org/draft-04/schema#'
    }, model);

    // Group of schema definitions with name: integers, objects, arrays...
    objEach(schema, function (rawGroup, groupName) {
      var newGroup;

      switch (groupName) {
      case 'integers':
        newGroup = schema.integers = {};
        objEach(rawGroup, function (val, key) {
          newGroup[key] = extend({ type: 'integer' }, val);
        });
        break;
      case 'root':
        delete schema.root;
        schema.type = 'object';
        schema.properties = rawGroup[Object.keys(rawGroup)[0]];
        schema.additionalProperties = false;
        break;
      case 'objects':
        newGroup = schema.objects = {};
        objEach(rawGroup, function (val, key) {
          newGroup[key] = {
            type: 'object',
            properties: noAccessor(val),
            additionalProperties: false
          };
        });
        break;
      case 'elements':
        newGroup = schema.elements = {};
        objEach(rawGroup, function (val, key) {
          newGroup[key] = {
            type: 'object',
            properties: {},
            additionalProperties: false
          };
          newGroup[key].properties[key] = val.type ? val : {
            type: 'object',
            properties: noAccessor(val),
            additionalProperties: false
          };
        });
        break;
      case 'arrays':
        newGroup = schema.arrays = {};
        objEach(rawGroup, function (val, key) {
          newGroup[key] = {
            type: 'array',
            items: val,
            addtionalItems: false
          };
          if (Array.isArray(val)) {
            newGroup[key].items = { oneOf: val };
          }
        });
        break;
      }
    });

    return schema;
  };

}(musje));

/* global musje */

/**
 * musje.score model definitions
 */
(function (musje) {
  'use strict';

  // Constants and helpers
  // =================================================================

  var
    A4_FREQUENCY = 440,
    A4_MIDI_NUMBER = 69,
    TEMPO = 80,
    STEP_TO_MIDI_NUMBER = [null, 0, 2, 4, 5, 7, 9, 11],
    ACCIDENTAL_TO_ALTER = { '#' : 1, '##': 2, n: 0, b : -1, bb: -2 },
    TYPE_TO_STRING = {
      1: ' - - - ', 2: ' - ', 4: '', 8: '_', 16: '=', 32: '=_',
      64: '==', 128: '==_', 256: '===', 512: '===_', 1024: '===='
    },
    // Convert from duration type to number of underbars.
    TYPE_TO_UNDERBAR = {
      1: 0, 2: 0, 4: 0, 8: 1, 16: 2, 32: 3,
      64: 4, 128: 5, 256: 6, 512: 7, 1024: 8
    },
    DOT_TO_STRING = { 0: '', 1: '.', 2: '..' },
    BAR_TO_STRING = {
      single: '|', double: '||', end: '|]',
      'repeat-begin': '|:', 'repeat-end': ':|', 'repeat-both': ':|:'
    };

  function chars(ch, num) {
    return new Array(num + 1).join(ch);
  }

  function octaveString(octave) {
    return octave > 0 ? chars('\'', octave) :
           octave < 0 ? chars(',', -octave) : '';
  }

  function getAlter(pitch) {
    var
      note = pitch.note,
      step = pitch.step,
      data = note.cell.data,
      datum,
      i;

    for (i = note.index - 1; i >= 0; i--) {
      datum = data[i];
      if (datum.$name === 'Note' &&
          datum.pitch.step === step && datum.pitch.accidental) {
        // note.alterLink = datum;
        return datum.pitch.alter;
      }
    }
    return 0;
  }

  // Musje model definitions
  // =================================================================
  musje.model = {
    title: 'Musje',
    description: '123 jianpu music score',

    // Root object
    // ---------------------------------------------------------------
    root: {
      Score: {
        head: { $ref: '#/objects/ScoreHead' },
        parts: { $ref: '#/arrays/Parts' },

        toString: function () {
          return this.head + this.parts.map(function (part) {
            return part.toString();
          }).join('\n\n');
        }
      }
    },

    // Integers
    // ---------------------------------------------------------------
    integers: {
      beatType: {
        enum: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
        default: 4
      }
    },

    // Objects
    // ---------------------------------------------------------------
    objects: {
      ScoreHead: {
        title: { type: 'string' },
        composer: { type: 'string' },
        isEmpty: function () {
          return !this.title && !this.composer;
        },
        toString: function () {
          return '<<' + this.title + '>>' + this.composer + '\n';
        }
      },

      Part: {
        // head: { $ref: '#/objects/PartHead' },
        measures: { $ref: '#/arrays/Measures' },
        toString: function () {
          return this.measures.map(function (cell) {
            return cell;
          }).join(' ');
        }
      },

      Cell: {
        data: { $ref: '#/arrays/MusicData' },
        toString: function () {
          return this.data.map(function (musicData) {
            return musicData.toString();
          }).join(' ');
        }
      },

      // partHead: TO BE DEFINED!,

      Pitch: {
        step: {
          type: 'integer',
          minimum: 1,
          maximum: 7,
          default: 1
        },
        octave: {
          type: 'integer',
          minimum: -5,
          maximum: 5,
          default: 0
        },
        accidental: {
          type: 'string',
          enum: ['#', 'b', '', 'n', '##', 'bb'],
          default: ''
        },
        alter: {
          get: function () {
            var acc = this.accidental;
            return acc ? ACCIDENTAL_TO_ALTER[acc] : getAlter(this);
          }
        },
        midiNumber: {
          get: function () {
            return (this.octave + 5) * 12 +
              STEP_TO_MIDI_NUMBER[this.step] + this.alter;
          }
        },
        frequency: {
          get: function () {
            return A4_FREQUENCY * Math.pow(2, (this.midiNumber - A4_MIDI_NUMBER) / 12);
          }
        },
        toString: function () {
          return this.accidental + this.step + octaveString(this.octave);
        }
      },

      Duration: {
        type: { $ref: '#/integers/beatType' },
        dot: {
          type: 'integer',
          minimum: 0,
          maximum: 2,
          default: 0
        },
        quarter: {
          get: function () {
            var d = 4 / this.type;
            return this.dot === 0 ? d :
                   this.dot === 1 ? d * 1.5 : d * 1.75;
          }
        },
        second: {
          get: function () {
            return this.quarter * 60 / TEMPO;
          }
        },
        underbar: {
          get: function () {
            return TYPE_TO_UNDERBAR[this.type] || 0;
          }
        },
        toString: function () {
          return TYPE_TO_STRING[this.type] + DOT_TO_STRING[this.dot];
        }
      }
    },

    // Elements are use inside an array
    // ---------------------------------------------------------------
    elements: {
      Time: {
        beats: {
          type: 'integer',
          default: 4
        },
        beatType: { $ref: '#/integers/beatType' },
        toString: function () {
          return this.beats + '/' + this.beatType;
        }
      },

      Note: {
        pitch: { $ref: '#/objects/Pitch' },
        duration: { $ref: '#/objects/Duration' },
        slurs: { $ref: '#/arrays/Slurs' },
        tie: {
          type: 'boolean',
          default: false
        },
        toString: function () {
          return this.pitch + this.duration;
        }
      },

      Rest: {
        duration: { $ref: '#/objects/Duration' },
        toString: function () {
          return '0' + this.duration;
        }
      },

      Chord: {
        pitches: {
          type: 'array',
          items: { $ref: '#/objects/Pitch' }
        },
        duration: { $ref: '#/objects/Duration' },
        toString: function () {
          return '<' + this.pitches.map(function (pitch) {
            return pitch.toString();
          }).join('') + '>' + this.duration;
        }
      },

      // Voice: {
      //   type: 'array',
      //   items: {
      //     oneOf: [
      //       { $ref: '#/elements/Note' },
      //       { $ref: '#/elements/Rest' },
      //       { $ref: '#/elements/Chord' },
      //     ]
      //   }
      // }

      Bar: {
        type: 'string',
        enum: [
          'single', 'double', 'end',
          'repeat-begin', 'repeat-end', 'repeat-both'
        ],
        default: 'single',
        toString: function () {
          return BAR_TO_STRING[this.value];
        }
      }
    },

    // Arrays
    // ---------------------------------------------------------------
    arrays: {
      Parts: { $ref: '#/objects/Part' },
      Measures: { $ref: '#/objects/Cell' },
      MusicData: [
        { $ref: '#/elements/Time' },
        { $ref: '#/elements/Note' },
        { $ref: '#/elements/Rest' },
        { $ref: '#/elements/Chord' },
        // { $ref: '#/elements/Voice' },
        { $ref: '#/elements/Bar' }
      ],
      Slurs: {
        type: 'string',
        enum: ['begin', 'end']
      }
    }
  };

  musje.makeClasses(musje, musje.model);

  /**
   * Usage:
   * var score = musje.score(JSONString or object);
   */
  musje.score = function (obj) {
    if (typeof obj === 'string') { obj = JSON.parse(obj); }
    return new musje.Score(obj).init();
  };

}(musje));

/* global musje */

(function (musje) {
  'use strict';

  var
    extend = musje.extend,
    near = musje.near;

  function getBeamedGroups(cell, groupDur) {
    var counter = 0, group = [], groups = [];

    function inGroup() {
      return counter < groupDur && !near(counter, groupDur);
    }
    function putGroup() {
      if (group.length > 1) { groups.push(group); }
      group = [];
    }

    cell.data.forEach(function (musicData) {
      if (musicData.$name !== 'Note' && musicData.$name !== 'Rest') {
        return;
      }
      var
        duration = musicData.duration,
        dur = duration.quarter;

      counter += dur;

      if (inGroup()) {
        if (duration.underbar) { group.push(musicData); }
      } else if (near(counter, groupDur)) {
        group.push(musicData);
        putGroup();
        counter = 0;
      } else {
        putGroup();
        counter %= groupDur;
      }
    });
    putGroup();

    return groups;
  }

  // @param cell {Array} either a measure in a part, or a part in a measure.
  // @param groupDur {number} Duration of a beam group in quarter.
  function makeBeams(cell, groupDur) {

    getBeamedGroups(cell, groupDur).forEach(function (group) {
      // beamLevel starts from 0 while underbar starts from 1
      var beamLevel = {};

      function nextHasSameBeamlevel(index, level) {
        var next = group[index + 1];
        return next && next.duration.underbar > level;
      }

      group.forEach(function(musicData, i) {
        var
          underbar = musicData.duration.underbar,
          level;
        for (level = 0; level < underbar; level++) {
          if (nextHasSameBeamlevel(i, level)) {
            musicData.beams = musicData.beams || {};
            if (beamLevel[level]) {
              musicData.beams[level] = 'continue';
            } else {
              beamLevel[level] = true;
              musicData.beams[level] = 'begin';
            }
          } else {
            if (beamLevel[level]) {
              musicData.beams = musicData.beams || {};
              musicData.beams[level] = 'end';
              delete beamLevel[level];
            }
          }
        }
      });
    });
  }

  function linkCellData(cell) {
    cell.data.forEach(function (data, d) {
      data.cell = cell;
      data.index = d;
      if (data.pitch) {
        data.pitch.note = data;
      }
    });
  }

  extend(musje.Score.prototype, {

    init: function () {
      this.prepareTimewise();
      this.extractBars();
      this.prepareCells();
      this.linkTies();
      return this;
    },

    // A cell is identically a measure in a part or a part in a measure.
    walkCells: function (callback) {
      this.parts.forEach(function (part, p) {
        part.measures.forEach(function (cell, m) {
          callback(cell, m, p);
        });
      });
    },
    walkMusicData: function (callback) {
      this.walkCells(function (cell, m, p) {
        cell.data.forEach(function (data, d) {
          callback(data, d, m, p);
        });
      });
    },

    prepareTimewise: function () {
      var measures = this.measures = [];
      this.walkCells(function (cell, m, p) {
        measures[m] = measures[m] || [];
        var measure = measures[m];
        measure.parts = measure.parts || [];
        measure.parts[p] = cell;
      });
    },

    // Extract bars in each cell out into the measure.
    extractBars: function () {
      var measures = this.measures;
      measures.forEach(function (measure, m) {
        measure.parts.forEach(function (cell) {
          var
            data = cell.data,
            len = data.length;
          if (!len) { return; }

          // barRight
          if (len && data[len - 1].$name === 'Bar') {
            measure.barRight = data.pop();
          }

          // barLeft
          if (data[0] && data[0].$name === 'Bar') {
            measure.barLeft = data.shift();
          } else {
            if (m !== 0) {
              measure.barLeft = measures[m - 1].barRight;
            }
          }
        });
      });
    },

    prepareCells: function () {
      this.walkCells(function (cell) {
        linkCellData(cell);
        makeBeams(cell, 1);
      });
    },

    linkTies: function () {
      var prev = null;

      this.walkMusicData(function (data) {
        var tie;

        if (data.$name === 'Note') {
          tie = data.tie;
          data.tie = {};
          if (prev) {
            data.tie.prev = prev;
            prev.tie.next = data;
          }
          prev = tie ? data : null;
        }
      });
    }

  });

}(musje));

(function (musje) {

/* parser generated by jison 0.4.15 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var parser = (function(){
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,11],$V1=[1,15],$V2=[1,16],$V3=[1,17],$V4=[1,18],$V5=[1,19],$V6=[1,20],$V7=[1,23],$V8=[1,27],$V9=[1,34],$Va=[1,35],$Vb=[1,33],$Vc=[1,28],$Vd=[1,29],$Ve=[5,9,10,14,21,22,23,24,25,26,29,34,39,41,48,51,58],$Vf=[2,8],$Vg=[5,9,10,21,22,23,24,25,26,29,34,39,41,48,51,58],$Vh=[5,21,22,23,24,25,26],$Vi=[2,46],$Vj=[1,48],$Vk=[1,49],$Vl=[1,50],$Vm=[1,51],$Vn=[1,52],$Vo=[5,9,10,21,22,23,24,25,26,28,29,34,35,39,41,48,51,53,58],$Vp=[5,9,10,21,22,23,24,25,26,28,29,34,35,39,41,43,44,45,46,47,48,51,53,58],$Vq=[5,9,10,21,22,23,24,25,26,28,29,34,35,39,41,43,44,45,46,47,48,50,51,53,58],$Vr=[1,63],$Vs=[1,64],$Vt=[5,21,22,23,24,25,26,29,34,39,41,48,51,58],$Vu=[5,9,10,21,22,23,24,25,26,28,29,34,35,39,41,43,48,51,53,58],$Vv=[5,9,10,21,22,23,24,25,26,28,29,34,39,41,48,51,53,58],$Vw=[39,41,50];
var parser = {trace: function trace() { },
yy: {},
symbols_: {"0":29,"error":2,"e":3,"maybe_musje":4,"EOF":5,"space":6,"maybe_space":7,"musje":8,"S":9,"NL":10,"score_head":11,"part_list":12,"title":13,"TITLE":14,"COMPOSER":15,"part":16,"measure_list":17,"bar":18,"measure":19,"music_data":20,"|":21,"||":22,"|]":23,"|:":24,":|":25,":|:":26,"slurable":27,"TIE":28,"maybe_duration":30,"voice":31,"time_signature":32,"pitchful":33,"(":34,")":35,"note":36,"chord":37,"pitch":38,"STEP":39,"OCTAVE":40,"ACCIDENTAL":41,"type_modifier":42,"DOT":43,"_":44,"=":45,"HALF":46,"WHOLE":47,"<":48,"pitch_list":49,">":50,"{":51,"voice_list":52,"}":53,"voice_data_list":54,":":55,"voice_data":56,"restslurable_list":57,"BEATS":58,"BEAT_TYPE":59,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",9:"S",10:"NL",14:"TITLE",15:"COMPOSER",21:"|",22:"||",23:"|]",24:"|:",25:":|",26:":|:",28:"TIE",29:"0",34:"(",35:")",39:"STEP",40:"OCTAVE",41:"ACCIDENTAL",43:"DOT",44:"_",45:"=",46:"HALF",47:"WHOLE",48:"<",50:">",51:"{",53:"}",54:"voice_data_list",55:":",57:"restslurable_list",58:"BEATS",59:"BEAT_TYPE"},
productions_: [0,[3,2],[4,0],[4,2],[4,3],[4,1],[6,1],[6,1],[7,0],[7,2],[7,2],[8,1],[8,1],[8,2],[11,2],[13,1],[13,2],[12,1],[16,1],[16,3],[17,1],[17,4],[17,3],[19,2],[19,3],[18,1],[18,1],[18,1],[18,1],[18,1],[18,1],[20,1],[20,2],[20,2],[20,1],[20,1],[27,2],[27,3],[27,3],[33,1],[33,1],[36,1],[38,1],[38,2],[38,2],[38,3],[30,0],[30,1],[30,1],[30,2],[42,1],[42,1],[42,2],[42,2],[42,3],[42,3],[42,1],[42,1],[37,3],[49,1],[49,2],[31,3],[52,1],[52,3],[56,1],[56,2],[32,2]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:
 return $$[$0-1]; 
break;
case 2: case 3:
 this.$ = null; 
break;
case 4: case 5:
 this.$ = $$[$0]; removeLastEmptyMeasure($$[$0]); 
break;
case 10:
 this.$ = $$[$0-1] ? $$[$0-1] + 1 : 1; 
break;
case 11:
 this.$ = { head: $$[$0] }; 
break;
case 12:
 this.$ = { parts: $$[$0] }; 
break;
case 13:
 this.$ = { head: $$[$0-1], parts: $$[$0] }; 
break;
case 15:
 this.$ = { title: $$[$0] }; 
break;
case 16:
 this.$ =  { title: $$[$0-1], composer: $$[$0] }; 
break;
case 17: case 20: case 59: case 62:
 this.$ = [$$[$0]]; 
break;
case 18:
 this.$ = { measures: $$[$0]}; 
break;
case 19:
 this.$ = { measures: $$[$0]}; $$[$0][0].data.unshift({ bar: $$[$0-2] }); 
break;
case 21:
 this.$ = $$[$0-3]; lastItem($$[$0-3]).data.push({ bar: $$[$0-2] }); $$[$0-3].push($$[$0]); 
break;
case 22:
 this.$ = $$[$0-2]; lastItem($$[$0-2]).data.push({ bar: $$[$0-1] }); $$[$0-2].push({ data: [] }); 
break;
case 23:
 this.$ = { data: [$$[$0-1]] }; 
break;
case 24:
 this.$ = $$[$0-2]; $$[$0-2].data.push($$[$0-1]); 
break;
case 25:
 this.$ = 'single'; 
break;
case 26:
 this.$ = 'double'; 
break;
case 27:
 this.$ = 'end'; 
break;
case 28:
 this.$ = 'repeat-begin'; 
break;
case 29:
 this.$ = 'repeat-end'; 
break;
case 30:
 this.$ = 'repeat-both'; 
break;
case 32:
 this.$ = $$[$0-1]; onlyProperty($$[$0-1]).tie = true; 
break;
case 33:
 this.$ = { rest: { duration: $$[$0] } }; 
break;
case 34:
 this.$ = { voice: $$[$0] }; 
break;
case 36:
 this.$ = $$[$0-1]; onlyProperty($$[$0-1]).duration = $$[$0]; 
break;
case 37:

      this.$ = $$[$0-1];
      extend(onlyProperty($$[$0-1]), {
        duration: $$[$0],
        slurs: ['begin']
      });
    
break;
case 38:

      this.$ = $$[$0-2];
      extend(onlyProperty($$[$0-2]), {
        duration: $$[$0-1],
        slurs: ['end']
      });
    
break;
case 39:
 this.$ = { note: $$[$0] }; 
break;
case 40:
 this.$ = { chord: $$[$0] }; 
break;
case 41:
 this.$ = { pitch: $$[$0] }; 
break;
case 42:
 this.$ = { step: +$$[$0] }; 
break;
case 43:
 this.$ = { step: +$$[$0-1], octave: octave($$[$0]) }; 
break;
case 44:
 this.$ = { accidental: $$[$0-1], step: +$$[$0] }; 
break;
case 45:
 this.$ = { accidental: $$[$0-2], step: +$$[$0-1], octave: octave($$[$0]) }; 
break;
case 46:
 this.$ = { type: 4 }; 
break;
case 47:
 this.$ = { type: $$[$0] }; 
break;
case 48:
 this.$ = { type: 4, dot: $$[$0].length }; 
break;
case 49:
 this.$ = { type: $$[$0-1], dot: $$[$0].length }; 
break;
case 50:
 this.$ = 8; 
break;
case 51:
 this.$ = 16; 
break;
case 52:
 this.$ = 32; 
break;
case 53:
 this.$ = 64; 
break;
case 54:
 this.$ = 128; 
break;
case 55:
 this.$ = 256; 
break;
case 56:
 this.$ = 2; 
break;
case 57:
 this.$ = 1; 
break;
case 58:
 this.$ = { pitches: $$[$0-1] }; 
break;
case 60: case 65:
 this.$ = $$[$0-1]; $$[$0-1].push($$[$0]); 
break;
case 61:
 this.$ = $$[$0-1]; 
break;
case 63:
 this.$ = $$[$0-2]; $$[$0-2].push($$[$0-1]); 
break;
case 66:
 this.$ = { time: { beats: +$$[$0-1], beatType: +$$[$0] } }; 
break;
}
},
table: [{3:1,4:2,5:[2,2],6:3,8:4,9:[1,5],10:[1,6],11:7,12:8,13:9,14:$V0,16:10,17:12,18:13,19:14,20:21,21:$V1,22:$V2,23:$V3,24:$V4,25:$V5,26:$V6,27:22,29:$V7,31:24,32:25,33:26,34:$V8,36:30,37:31,38:32,39:$V9,41:$Va,48:$Vb,51:$Vc,58:$Vd},{1:[3]},{5:[1,36]},o($Ve,$Vf,{7:37}),{5:[2,5]},o($Ve,[2,6]),o($Ve,[2,7]),{5:[2,11],12:38,16:10,17:12,18:13,19:14,20:21,21:$V1,22:$V2,23:$V3,24:$V4,25:$V5,26:$V6,27:22,29:$V7,31:24,32:25,33:26,34:$V8,36:30,37:31,38:32,39:$V9,41:$Va,48:$Vb,51:$Vc,58:$Vd},{5:[2,12]},o($Vg,$Vf,{7:39}),{5:[2,17]},o($Vg,[2,15],{15:[1,40]}),{5:[2,18],18:41,21:$V1,22:$V2,23:$V3,24:$V4,25:$V5,26:$V6},o([9,10,29,34,39,41,48,51,58],$Vf,{7:42}),o($Vh,[2,20],{27:22,31:24,32:25,33:26,36:30,37:31,38:32,20:43,29:$V7,34:$V8,39:$V9,41:$Va,48:$Vb,51:$Vc,58:$Vd}),o($Vg,[2,25]),o($Vg,[2,26]),o($Vg,[2,27]),o($Vg,[2,28]),o($Vg,[2,29]),o($Vg,[2,30]),o($Vg,$Vf,{7:44}),o($Vg,[2,31],{28:[1,45]}),o($Vg,$Vi,{30:46,42:47,43:$Vj,44:$Vk,45:$Vl,46:$Vm,47:$Vn}),o($Vg,[2,34]),o($Vg,[2,35]),o($Vo,$Vi,{42:47,30:53,43:$Vj,44:$Vk,45:$Vl,46:$Vm,47:$Vn}),{33:54,36:30,37:31,38:32,39:$V9,41:$Va,48:$Vb},{52:55,54:[1,56]},{59:[1,57]},o($Vp,[2,39]),o($Vp,[2,40]),o($Vp,[2,41]),{38:59,39:$V9,41:$Va,49:58},o($Vq,[2,42],{40:[1,60]}),{39:[1,61]},{1:[2,1]},{5:[2,3],8:62,9:$Vr,10:$Vs,11:7,12:8,13:9,14:$V0,16:10,17:12,18:13,19:14,20:21,21:$V1,22:$V2,23:$V3,24:$V4,25:$V5,26:$V6,27:22,29:$V7,31:24,32:25,33:26,34:$V8,36:30,37:31,38:32,39:$V9,41:$Va,48:$Vb,51:$Vc,58:$Vd},{5:[2,13]},o($Vt,[2,14],{9:$Vr,10:$Vs}),o($Vg,[2,16]),o($Vg,$Vf,{7:65}),{9:$Vr,10:$Vs,17:66,19:14,20:21,27:22,29:$V7,31:24,32:25,33:26,34:$V8,36:30,37:31,38:32,39:$V9,41:$Va,48:$Vb,51:$Vc,58:$Vd},o($Vg,$Vf,{7:67}),o($Vt,[2,23],{9:$Vr,10:$Vs}),o($Vg,[2,32]),o($Vg,[2,33]),o($Vo,[2,47],{43:[1,68]}),o($Vo,[2,48]),o($Vu,[2,50]),o($Vu,[2,51],{44:[1,69],45:[1,70]}),o($Vu,[2,56]),o($Vu,[2,57]),o($Vv,[2,36],{35:[1,71]}),o($Vv,$Vi,{42:47,30:72,43:$Vj,44:$Vk,45:$Vl,46:$Vm,47:$Vn}),{53:[1,73]},{53:[2,62],55:[1,74]},o($Vg,[2,66]),{38:76,39:$V9,41:$Va,50:[1,75]},o($Vw,[2,59]),o($Vq,[2,43]),o($Vq,[2,44],{40:[1,77]}),{5:[2,4]},o($Ve,[2,9]),o($Ve,[2,10]),o($Vh,[2,22],{20:21,27:22,31:24,32:25,33:26,36:30,37:31,38:32,19:78,9:$Vr,10:$Vs,29:$V7,34:$V8,39:$V9,41:$Va,48:$Vb,51:$Vc,58:$Vd}),{5:[2,19],18:41,21:$V1,22:$V2,23:$V3,24:$V4,25:$V5,26:$V6},o($Vt,[2,24],{9:$Vr,10:$Vs}),o($Vo,[2,49]),o($Vu,[2,52]),o($Vu,[2,53],{44:[1,79],45:[1,80]}),o($Vv,[2,38]),o($Vv,[2,37]),o($Vg,[2,61]),{27:82,33:26,34:$V8,36:30,37:31,38:32,39:$V9,41:$Va,48:$Vb,56:81,57:[1,83]},o($Vp,[2,58]),o($Vw,[2,60]),o($Vq,[2,45]),o($Vh,[2,21],{27:22,31:24,32:25,33:26,36:30,37:31,38:32,20:43,29:$V7,34:$V8,39:$V9,41:$Va,48:$Vb,51:$Vc,58:$Vd}),o($Vu,[2,54]),o($Vu,[2,55]),{53:[2,63]},{53:[2,64]},{27:84,33:26,34:$V8,36:30,37:31,38:32,39:$V9,41:$Va,48:$Vb},{53:[2,65]}],
defaultActions: {4:[2,5],8:[2,12],10:[2,17],36:[2,1],38:[2,13],62:[2,4],81:[2,63],82:[2,64],84:[2,65]},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new Error(str);
    }
},
parse: function parse(input) {
    var self = this, stack = [0], tstack = [], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
    var lexer = Object.create(this.lexer);
    var sharedState = { yy: {} };
    for (var k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
            sharedState.yy[k] = this.yy[k];
        }
    }
    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc == 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);
    var ranges = lexer.options && lexer.options.ranges;
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    _token_stack:
        function lex() {
            var token;
            token = lexer.lex() || EOF;
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
            return token;
        }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(lexer.yytext);
            lstack.push(lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                sharedState.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};


  var extend = musje.extend;

  function lastItem(arr) { return arr[arr.length - 1]; }

  function onlyProperty(obj) {
    for (var key in obj) {}
    return obj[key];
  }

  function octave(str) {
    var len = str.length;
    return str.charAt(0) === ',' ? -len : len;
  }

  function removeLastEmptyMeasure(score) {
    var
      parts = score.parts,
      lastMeasure,
      i;

    for (i = 0; i < parts.length; i++) {
      lastMeasure = lastItem(parts[i].measures);
      if (lastMeasure.data.length === 0) {
        parts[i].measures.pop();
      }
    }
  }

/* generated by jison-lex 0.3.4 */
var lexer = (function(){
var lexer = ({

EOF:1,

parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0,0];
        }
        this.offset = 0;
        return this;
    },

// consumes and returns one char from the input
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
    },

// unshifts one char (or a string) into the input
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;

        this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                 + oldLines[oldLines.length - lines.length].length - lines[0].length :
              this.yylloc.first_column - len
        };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
    },

// When called from action, caches matched text and appends it on next action
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });

        }
        return this;
    },

// retain first n characters of the match
less:function (n) {
        this.unput(this.match.slice(n));
    },

// displays already matched input, i.e. for error messages
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },

// displays upcoming input, i.e. for error messages
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
    },

// displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
    },

// return next match in input
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });
        }
    },

// return next match that has a token
lex:function lex() {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0:return 9
break;
case 1:return 9
break;
case 2:return 9
break;
case 3: this.begin('title'); 
break;
case 4: yy_.yytext = yy_.yytext.substr(0, yy_.yyleng - 2).trim();
                          return 14; 
break;
case 5: this.begin('INITIAL'); 
break;
case 6: this.begin('INITIAL');
                          yy_.yytext = yy_.yytext.trim();
                          return 15; 
break;
case 7: this.begin('time');
                          yy_.yytext = yy_.yytext.substr(0, yy_.yyleng - 1);
                          return 58; 
break;
case 8: this.begin('INITIAL'); return 59; 
break;
case 9:return 41
break;
case 10:return 39
break;
case 11:return 40
break;
case 12:return 43
break;
case 13:return 47
break;
case 14:return 46
break;
case 15:return 28
break;
case 16:return 44
break;
case 17:return 45
break;
case 18:return '.'
break;
case 19:return 29
break;
case 20:return 48
break;
case 21:return 50
break;
case 22:return 34
break;
case 23:return 35
break;
case 24:return '/'
break;
case 25:return '\\'
break;
case 26:return 23
break;
case 27:return 22
break;
case 28:return '[|'
break;
case 29:return 24
break;
case 30:return 26
break;
case 31:return 25
break;
case 32:return 21
break;
case 33:return 51
break;
case 34:return 53
break;
case 35:return 55
break;
case 36:return 10
break;
case 37:return 9
break;
case 38:return 5
break;
case 39:return 'INVALID'
break;
}
},
rules: [/^(?:\/\/[^\n]*)/,/^(?:\/\*([\s\S]*?)\*\/)/,/^(?:\/\*[\s\S]*)/,/^(?:<<)/,/^(?:.*>>)/,/^(?:([ \t])*([\n\r]))/,/^(?:.*)/,/^(?:(([1-9]\d{0,2})\/))/,/^(?:([1-9]\d{0,2})[^\d])/,/^(?:(#{1,2}|n|b{1,2}))/,/^(?:[1-7])/,/^(?:,+|'+)/,/^(?:\.+)/,/^(?:( *- *){3})/,/^(?:( *- *))/,/^(?: *~)/,/^(?:[_])/,/^(?:=)/,/^(?:\.)/,/^(?:[0])/,/^(?:<)/,/^(?:>)/,/^(?:\()/,/^(?:\))/,/^(?:\/)/,/^(?:\\)/,/^(?:\|\])/,/^(?:\|\|)/,/^(?:\[\|)/,/^(?:\|:)/,/^(?::\|:)/,/^(?::\|)/,/^(?:\|)/,/^(?:\{)/,/^(?:\})/,/^(?::)/,/^(?:([\n\r]))/,/^(?:([ \t]))/,/^(?:$)/,/^(?:.)/],
conditions: {"time":{"rules":[8],"inclusive":false},"title":{"rules":[4,5,6],"inclusive":false},"INITIAL":{"rules":[0,1,2,3,7,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39],"inclusive":true}}
});
return lexer;
})();
parser.lexer = lexer;
function Parser () {
  this.yy = {};
}
Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();

  musje.parse = function (input) {
    var plainScore = parser.parse(input);
    return musje.score(plainScore);
  };

}(musje));

/* global musje */

(function (musje) {
  'use strict';

  musje.svgPaths = {

    // https://upload.wikimedia.org/wikipedia/commons/a/a6/Sharp.svg
    '#': 'M6.102,7.457V2.753L8.102,2.201V6.881L6.102,7.457zM10.04,6.319L8.665,6.713V2.033L10.04,1.649V-0.295L8.665,0.089V-4.69277H8.102V0.234L6.102,0.809V-3.84077H5.571V0.986L4.196,1.371V3.319L5.571,2.935V7.606L4.196,7.989V9.929L5.571,9.545V14.299L6.102,14.29977V9.375L8.102,8.825V13.45077H8.665V8.651L10.04,8.266V6.319z',

    // https://upload.wikimedia.org/wikipedia/commons/3/3a/DoubleSharp.svg
    '##': 'M5.009,8.30721C4.27443,8.19192 3.52769,8.19209 2.7858,8.19294C2.77007,7.65011 2.85674,7.0729 2.6415,6.56343C2.49821,6.22426 2.22532,5.95665 1.98269,5.68155C1.59552,6.0278 1.27751,6.48475 1.24704,7.01638C1.21706,7.40767 1.23902,7.80085 1.2322,8.19294C0.4904,8.20416-0.25918,8.16828-0.991,8.314C-0.84988,7.5863-0.88195,6.84171-0.86917,6.1048C-0.3043,6.08953 0.30023,6.17101 0.82484,5.92526C1.13441,5.78023 1.39653,5.55295 1.6591,5.33676C1.3173,4.94965 0.87346,4.60861 0.33665,4.57651C-0.06427,4.54485-0.46734,4.56793-0.86917,4.56097C-0.89434,3.82949-0.80895,3.08855-0.96079,2.3663C-0.23733,2.49697 0.50065,2.46343 1.2322,2.47284C1.24306,2.99383 1.18483,3.53381 1.33191,4.0355C1.44414,4.41838 1.74978,4.71293 2.0051,5.01521C2.36553,4.70111 2.69057,4.30706 2.75011,3.81412C2.804,3.36793 2.76123,2.91977 2.7858,2.47284C3.52263,2.45348 4.28215,2.54713 4.99535,2.314C4.88891,3.05711 4.87889,3.81152 4.88717,4.56097C4.36127,4.57582 3.80954,4.51747 3.30955,4.69457C2.92975,4.8291 2.63114,5.12341 2.32869,5.38325C2.65661,5.71867 3.0516,6.02802 3.5403,6.07368C3.98834,6.11554 4.43829,6.09658 4.88717,6.1048C4.89828,6.83958 4.86193,7.5825 5.009,8.30721z',

    // https://upload.wikimedia.org/wikipedia/commons/b/ba/Flat.svg
    b: 'M8.166,3.657C8.166,4.232 7.950425,4.78273 7.359,5.52188C6.732435,6.30494 6.205,6.75313 5.51,7.28013V3.848C5.668,3.449 5.901,3.126 6.21,2.878C6.518,2.631 6.83,2.507 7.146,2.507C7.668,2.507 7.999,2.803 8.142,3.393C8.158,3.441 8.166,3.529 8.166,3.657zM8.091,1.257C7.66,1.257 7.222,1.376 6.776,1.615C6.33,1.853 5.908,2.172 5.51,2.569V-4.70267H4.947 V7.75213C4.947,8.10413 5.043,8.28013 5.235,8.28013C5.346,8.28013 5.483913,8.18713 5.69,8.06413C6.27334,7.71598 6.636935,7.48332 7.032,7.23788C7.482617,6.95792 7.99,6.631 8.661,5.991C9.124,5.526 9.459,5.057 9.667,4.585C9.874,4.112 9.978,3.644 9.978,3.179C9.978,2.491 9.795,2.002 9.429,1.713C9.015,1.409 8.568,1.257 8.091,1.257z',

    // https://upload.wikimedia.org/wikipedia/commons/f/f4/Music-natural.svg
    n: 'M 0,14.112V41.52h-1.248V31.248l-6.672,1.728V5.232h1.2v10.704l6.72,-1.824zm-6.72,6.432v7.536l5.472,-1.44v-7.536l-5.472,1.44z',

    ACCIDENTAL_RATIOS: { '#': 0.043, 'n': 0.023, '##': 0.062, b: 0.057 },
    ACCIDENTAL_SHIFTS: { '#': 1, 'n': 2, '##': -4, b: 0 }
  };

}(musje));

/* global musje, Snap */

(function (musje) {
  'use strict';

  var BAR_TO_ID = {
    single: 'bs', double: 'bd', end: 'be',
    'repeat-begin': 'brb', 'repeat-end': 'bre', 'repeat-both': 'brbe'
  };

  var defIds = {
    Time: function () {
      return ['t', this.beats, '-', this.beatType].join('');
    },
    Bar: function () {
      return BAR_TO_ID[this.value];
    },
    Note: function () {
      var pitch = this.pitch, duration = this.duration;
      return [
        'n', pitch.accidental.replace(/#/g, 's'),
        pitch.step, pitch.octave, duration.type, duration.dot
      ].join('');
    },
    Rest: function () {
      var duration = this.duration;
      return 'r' + duration.type + duration.dot;
    },
    Pitch: function () {
      return ['p', this.accidental.replace(/#/g, 's'),
                   this.step, this.octave].join('');
    },
    Duration: function () {
      return 'd' + this.type + this.dot;
    }
  };

  musje.objEach(defIds, function (getter, className) {
    Object.defineProperty(musje[className].prototype, 'defId', {
      get: getter
    });
  });

}(musje, Snap));

/* global musje */

(function (musje) {
  'use strict';

  // @constructor Defs
  // SVG definitions
  var Defs = musje.Defs = function (layout) {
    this._layout = layout;
  };

  Defs.prototype.get = function (musicData) {
    var id = musicData.defId;
    return this[id] || (this[id] = this._make(id, musicData));
  };

  Defs.prototype.getAccidental = function (accidental) {
    var id = 'a' + accidental.replace(/#/g, 's');
    return this[id] ||
        (this[id] = new Defs.AccidentalDef(id, accidental, this._layout));
  };

  Defs.prototype._make = function (id, musicData) {
    var maker = '_make' + musicData.$name;
    return this[maker](id, musicData) || { width: 0, height: 0 };
  };

  Defs.prototype._makeBar = function (id, bar) {
    return new Defs.BarDef(id, bar, this._layout);
  };

  Defs.prototype._makeTime = function (id, time) {
    return new Defs.TimeDef(id, time, this._layout);
  };

  Defs.prototype._makeDuration = function (id, duration) {
    return new Defs.DurationDef(id, duration, this._layout);
  };

  Defs.prototype._getPitch = function (id, pitch, underbar) {
    return this[id] ||
        (this[id] = new Defs.PitchDef(id, pitch, underbar, this));
  };

  Defs.prototype._makeNote = function (id, note) {
    var
      pitch = note.pitch,
      underbar = note.duration.underbar,
      pitchId = pitch.defId + underbar,
      pitchDef = this._getPitch(pitchId, pitch, underbar),
      durationDef = this.get(note.duration);

    return {
      pitchDef: pitchDef,
      durationDef: durationDef,
      height: pitchDef.height,
      width: pitchDef.width + durationDef.width,
      minWidth: pitchDef.width + durationDef.minWidth,
      maxWidth: pitchDef.width + durationDef.maxWidth
    };
  };

  // Rest does not have its only RestDef class.
  // It is just a trick to use a note with pitch.step = 0.
  Defs.prototype._makeRest = function(id, rest) {
    var
      duration = rest.duration,
      pitchDef = this._getPitch(id, { step: 0, octave: 0 }, duration.underbar),
      durationDef = this.get(duration);

    return {
      pitchDef: pitchDef,
      durationDef: durationDef,
      height: pitchDef.height,
      width: pitchDef.width + durationDef.width
    };
  };

}(musje));

/* global musje */

(function (Defs) {
  'use strict';

  // @constructor BarDef
  // SVG definition for barline.
  var BarDef = Defs.BarDef = function (id, bar, layout) {
    var
      lo = layout.options,
      x = 0,
      lineWidth;

    this.el = layout.svg.el.g().attr('id', id).toDefs();

    switch (bar.value) {
    case 'single':
      lineWidth = lo.thinBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth;
      break;
    case 'double':
      lineWidth = lo.thinBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth + lo.barlineSep;
      this._addBarline(x, lineWidth);
      x += lineWidth;
      break;
    case 'end':
      lineWidth = lo.thinBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth + lo.barlineSep;
      lineWidth = lo.thickBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth;
      break;
    case 'repeat-begin':
      lineWidth = lo.thickBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth + lo.barlineSep;
      lineWidth = lo.thinBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth + lo.barlineDotSep + lo.barlineDotRadius;
      break;
    case 'repeat-end':
      x = lo.barlineDotSep + lo.barlineDotRadius;
      lineWidth = lo.thinBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth + lo.barlineSep;
      lineWidth = lo.thickBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth;
      break;
    case 'repeat-both':
      x = lo.barlineDotSep + lo.barlineDotRadius;
      lineWidth = lo.thinBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth + lo.barlineSep;
      lineWidth = lo.thickBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth + lo.barlineSep;
      lineWidth = lo.thinBarlineWidth;
      this._addBarline(x, lineWidth);
      x += lineWidth + lo.barlineDotSep + lo.barlineDotRadius;
      break;
    }

    this.width = x;
  };

  BarDef.prototype._addBarline = function (x, width) {
    this.el.rect(x, 0, width, 1);
  };

}(musje.Defs));

/* global musje, Snap */

(function (Defs, Snap) {
  'use strict';

  // @constructor TimeDef
  // SVG definition for Time signature.
  Defs.TimeDef = function (id, time, layout) {
    var
      lo = layout.options,
      timeFontSize = lo.timeFontSize,
      lineExtend = timeFontSize * 0.1,
      el = this.el = layout.svg.el.g()
        .attr({
          id: id,
          fontSize: timeFontSize,
          fontWeight: lo.timeFontWeight,
          textAnchor: 'middle'
        }),
      lineY = -0.85 * timeFontSize,
      bb;

    el.text(0, -1 * timeFontSize, time.beats);
    el.text(0, 0, time.beatType);   // baseline y = 0
    bb = el.getBBox();
    el.line(bb.x - lineExtend, lineY, bb.x2 + lineExtend, lineY);
    el.transform(Snap.matrix().scale(1, 0.8).translate(lineExtend - bb.x, 0));

    bb = el.getBBox();
    el.toDefs();

    this.width = bb.width;
    this.height = -bb.y;
  };

}(musje.Defs, Snap));

/* global musje, Snap */

(function (Defs, Snap) {
  'use strict';

  var svgPaths = musje.svgPaths;

  // @constructor AccidentalDef
  // SVG definition for accidental
  Defs.AccidentalDef = function (id, accidental, layout) {
    var
      lo = layout.options,
      el = this.el = layout.svg.el.g().attr('id', id),
      accKey = accidental.replace(/bb/, 'b'), // double flat to be synthesized
      pathData = svgPaths[accKey],
      ratio = svgPaths.ACCIDENTAL_RATIOS[accKey],
      shift = svgPaths.ACCIDENTAL_SHIFTS[accKey],
      path = el.path(pathData),
      bb = el.getBBox();

    path.transform(Snap.matrix()
      .translate(0.1 * lo.accidentalShift, -lo.accidentalShift)
      .scale(ratio * lo.accidentalFontSize)
      .translate(-bb.x, shift - bb.y2)
    );

    // Combine two flat to be double flat.
    if (accidental === 'bb') {
      el.use(path).attr('x', lo.accidentalFontSize * 0.24);
      el.transform('scale(0.9,1)');
    }

    bb = el.getBBox();
    this.width = bb.width * 1.2;

    el.toDefs();
  };

}(musje.Defs, Snap));

/* global musje, Snap */

(function (musje, Snap) {
  'use strict';

  var
    extend = musje.extend,
    near = musje.near,
    Defs = musje.Defs;

  function getBBoxAfterTransform(container, bbox, matrix) {
    var
      rect = container.rect(bbox.x, bbox.y, bbox.width, bbox.height),
      g = container.g(rect);

    rect.transform(matrix);
    bbox = g.getBBox();
    g.remove();
    return bbox;
 }

  // @constructor PitchDef
  // SVG definition for pitch.
  // The `PitchDef` is defined by properties: a s o u
  // accidental step octave underbar
  var PitchDef = Defs.PitchDef = function (id, pitch, underbar, defs) {
    var
      layout = this._layout = defs._layout,
      accidental = pitch.accidental,
      octave = pitch.octave,
      scale = getScale(accidental, octave, underbar),
      el = this.el = layout.svg.el.g().attr({
        id: id,
        stroke: 'black',
        strokeWidth: 2 - (scale.x + scale.y)
      }),
      matrix,
      sbbox,
      pbbox;

    this._defs = defs;
    this._addAccidental(accidental);
    this._addStep(pitch.step);
    this._addOctave(octave);

    matrix = this._getMatrix(scale, octave, underbar);
    el.transform(matrix);

    sbbox = this._sbbox;
    sbbox = getBBoxAfterTransform(this.el, sbbox, matrix);

    pbbox = el.getBBox();
    el.toDefs();

    extend(this, {
      scale: scale,
      matrix: matrix,
      width: pbbox.width,
      height: -pbbox.y,
      stepCx: sbbox.cx,
      stepY: sbbox.y,
      stepCy: sbbox.cy,
      stepY2: sbbox.y2,
      stepTop: octave > 0 ? pbbox.y : sbbox.y + layout.options.fontSize * 0.2
    });
  };

  PitchDef.prototype._addAccidental = function (accidental) {
    if (!accidental) {
      this._accidentalX2 = 0;
      return;
    }

    var
      accDef = this._defs.getAccidental(accidental);

    this.el.use(accDef.el).attr('y', -this._layout.options.accidentalShift);
    this._accidentalX2 = accDef.width;
  };

  PitchDef.prototype._addStep = function (step) {
    this._sbbox = this.el
      .text(this._accidentalX2, 0, '' + step)
      .attr('font-size', this._layout.options.fontSize)
      .getBBox();
  };

  PitchDef.prototype._addOctave = function (octave) {
    if (!octave) { return; }

    var
      lo = this._layout.options,
      octaveRadius = lo.octaveRadius,
      octaveOffset = lo.octaveOffset,
      octaveSep = lo.octaveSep,
      octaveEl = this.el.g(),
      i;

    if (octave > 0) {
      for (i = 0; i < octave; i++) {
        octaveEl.circle(this._sbbox.cx, this._sbbox.y + octaveOffset - octaveSep * i, octaveRadius);
      }
    } else {
      for (i = 0; i > octave; i--) {
        octaveEl.circle(this._sbbox.cx, this._sbbox.y2 - octaveOffset - octaveSep * i, octaveRadius);
      }
    }
    this.el.add(octaveEl);
  };

  function getScale(hasAccidental, octave, underbar) {
    var absOctave = Math.abs(octave);
    return {
      x: Math.pow(0.97, absOctave + underbar + (hasAccidental ? 2 : 0)),
      y: Math.pow(0.95, absOctave + underbar + (hasAccidental ? 1 : 0))
    };
  }

  // Transform the pitch to be in a good baseline position and
  // scale it to be more square.
  PitchDef.prototype._getMatrix = function (scale, octave, underbar) {
    var
      lo = this._layout.options,
      pbbox = this.el.getBBox(),
      dy = (octave >= 0 && underbar === 0 ? -lo.stepBaselineShift : 0) -
                            underbar * lo.underbarSep;

    return Snap.matrix()
      .translate(-pbbox.x, dy)
      .scale(scale.x, scale.y)
      .translate(0, near(pbbox.y2, this._sbbox.y2) ? 0 : -pbbox.y2);
  };

}(musje, Snap));

/* global musje, Snap */

(function (Defs, Snap) {
  'use strict';

  // @constructor DurationDef
  // SVG Definition for duration.
  var DurationDef = Defs.DurationDef = function (id, duration, layout) {
    this._id = id;
    this._layout = layout;

    // only make def el for:
    // id = d10, d11, d12, d20, d21, d20, d41, d40
    switch (duration.type) {
    case 1:   // whole note
      this._makeEl();
      this._makeType1(id, duration.dot);
      break;
    case 2:   // half note
      this._makeEl();
      this._makeType2(id, duration.dot);
      break;
    default:  // other note types type quarter note def
      if (duration.dot === 0) {
        this.width = 0 ;
      } else {
        this._makeEl();
        this._makeType4(id, duration.dot);
      }
    }
  };

  DurationDef.prototype._makeEl = function () {
    this.el = this._layout.svg.el.g()
                .attr('id', this._id)
                .toDefs();
  };

  // Add dot for type 1 (whole) or type 2 (half) note.
  DurationDef.prototype._addDot = function (x, dot, type) {
    var lo = this._layout.options;

    if (dot > 0) {
      x += lo.dotOffset * (type === 1 ? 1.2 : 1);
      this.el.circle(x, 0, lo.dotRadius);
    }
    if (dot > 1) {
      x += lo.dotSep * (type === 1 ? 1.2 : 1);
      this.el.circle(x, 0, lo.dotRadius);
    }
    return x + lo.typebarExt;
  };

  DurationDef.prototype._makeType1 = function (id, dot) {
    var
      lo = this._layout.options,
      x = lo.typebarOffset;

    this._addLine(x);
    x += lo.typebarLength + lo.typebarSep;
    this._addLine(x);
    x += lo.typebarLength + lo.typebarSep;
    this._addLine(x);
    x += lo.typebarLength;

    this.width = this._addDot(x, dot, 1);
  };

  DurationDef.prototype._addLine = function (x) {
    var lo = this._layout.options;
    this.el.rect(x, -lo.typeStrokeWidth,
                 lo.typebarLength, lo.typeStrokeWidth);
  };

  DurationDef.prototype._makeType2 = function (id, dot) {
    var
      lo = this._layout.options,
      x = lo.typebarOffset;

    this._addLine(lo.typebarOffset);
    x += lo.typebarLength;
    this.width = this._addDot(x, dot, 2);
  };

  DurationDef.prototype._makeType4 = function (id, dot) {
    var
      lo = this._layout.options,
      x = lo.t4DotOffset;

    this.el.circle(x, -lo.t4DotBaselineShift, lo.dotRadius);
    if (dot > 1) {
      x += lo.t4DotSep;
      this.el.circle(x, -lo.t4DotBaselineShift, lo.dotRadius);
    }
    this.width = x + lo.t4DotExt;
  };

}(musje.Defs, Snap));

/* global musje */

(function (musje) {
  'use strict';

  var Layout = musje.Layout = function (svg, options) {
    this.options = options;
    this.svg = svg;

    this.svg = new Layout.Svg(this);
    this.body = new Layout.Body(this);
    this.header = new Layout.Header(this);
    this.content = new Layout.Content(this);

    this.defs = new musje.Defs(this);
  };

  Layout.prototype.flow = function (score) {
    this._init(score);
    this.content.flow(score.measures);
  };

  Layout.prototype._init = function (score) {
    var
      defs = this.defs,
      lo = this.options,
      measures = score.measures;

    measures.forEach(function (measure, m) {
      measure = measures[m] = new Layout.Measure(measure, defs, lo);
      measure.parts.forEach(function (cell) {
        cell.flow(defs, lo);
      });
      measure.calcMinWidth();
    });
  };

}(musje));

/* global musje */

(function (musje) {
  'use strict';

  var options = musje.Layout.options = {
    mode: 'block', // inline | block | paper
    // width: 650,
    // height: 600,
    marginTop: 25,
    marginRight: 30,
    marginBottom: 25,
    marginLeft: 30,
    margin: {
      get: function () {
        return [this.marginTop, this.marginRight, this.marginBottom, this.marginLeft];
      },
      set: function (arr) {
        switch (arr.length) {
        case 1:
          this.marginTop = this.marginRight = this.marginBottom = this.marginLeft = arr[0];
          return;
        case 2:
          this.marginTop = this.marginBottom = arr[0];
          this.marginRight = this.marginLeft = arr[1];
          return;
        case 4:
          this.marginTop = arr[0];
          this.marginRight = arr[1];
          this.marginBottom = arr[2];
          this.marginLeft = arr[3];
          return;
        default:
          throw new Error('Invalid input for margin.');
        }
      }
    },
    fontSize: 20,
    fontFamily: 'Helvetica, Arial, Sans Serif',

    titleFontSize: '110%',
    // titleFontFamily
    titleFontWeight: 'bold',
    composerFontSize: '90%',
    // composerFontFamily:
    composerFontWeight: 'bold',
    // composerFontStyle,
    timeFontSize: '95%',
    timeFontWeight: 'bold',

    headerSep: '100%',
    systemSep: '150%',
    musicDataSep: '20%',

    measurePaddingLeft: '50%',
    measurePaddingRight: '50%',

    thinBarlineWidth: '4%',
    thickBarlineWidth: '16%',
    barlineSep: '18%',
    barlineDotRadius: '7.5%',
    barlineDotSep: '22%',

    accidentalFontSize: '95%',
    accidentalShift: '10%',

    octaveRadius: '6.6%',
    octaveOffset: '0%',
    octaveSep: '23%',

    stepBaselineShift: '12%',  // for step without lower octave and underline

    typeStrokeWidth: '5%',
    typebarOffset: '30%',   // 1 - - -
    typebarLength: '55%',   // off len sep len sep len (dot) ext
    typebarSep: '45%',      // 1 -
    typebarExt: '20%',      // off len (dot) ext
    underbarSep: '17%',

    dotOffset: '60%',       // for type = 2
    dotRadius: '6.6%',      // 1 - . .
    dotSep: '60%',          // off len dotOff . dotSep . ext
    t4DotOffset: '30%',
    t4DotSep: '50%',
    t4DotExt: '25%',
    t4DotBaselineShift: '20%'
  };

  var fontSize = options.fontSize;

  musje.objEach(options, function (value, key) {
    if (typeof value !== 'string') { return; }

    var unit = value.replace(/[\d\.]+/, '');
    value = +value.replace(/[^\d\.]+/, '');

    switch (unit) {
    case '%':
      options[key] = fontSize * value / 100;
      break;
    case '': // fall through
    case 'px':
      options[key] = value;
      break;
    case 'others to be implemented':
      break;
    }
  });
}(musje));

/* global musje, Snap */

(function (Layout, Snap) {
  'use strict';

  var defineProperty = Object.defineProperty;

  var Svg = Layout.Svg = function (layout) {
    this._layout = layout;
    var lo = layout.options;

    this.el = Snap(layout.svg).attr({
        fontFamily: lo.fontFamily
      }).addClass('musje');
    this.el.clear();
    this.width = lo.width;
  };

  defineProperty(Svg.prototype, 'width', {
    get: function () {
      return this._w;
    },
    set: function (w) {
      this._w = w;
      this.el.attr('width', w);
      var body = this._layout.body;
      if (body) { body.width = w; }
    }
  });

  defineProperty(Svg.prototype, 'height', {
    get: function () {
      return this._h;
    },
    set: function (h) {
      this._h = h;
      this.el.attr('height', h);
    }
  });

}(musje.Layout, Snap));

/* global musje, Snap */

(function (Layout, Snap) {
  'use strict';

  var defineProperty = Object.defineProperty;

  var Body = Layout.Body = function (layout) {
    this._layout = layout;
    var
      svg = layout.svg,
      lo = layout.options;

    this.el = svg.el.g()
        .transform(Snap.matrix().translate(lo.marginLeft, lo.marginTop))
        .addClass('mus-body');
    this.width = lo.width - lo.marginLeft - lo.marginRight;
  };

  defineProperty(Body.prototype, 'width', {
    get: function () {
      return this._w;
    },
    set: function (w) {
      this._w = w;
      var layout = this._layout;
      if (layout.header) { layout.header.width = w; }
      if (layout.content) { layout.content.width = w; }
    }
  });

  defineProperty(Body.prototype, 'height', {
    get: function () {
      return this._h;
    },
    set: function (h) {
      var layout = this._layout, lo = layout.options;
      layout.svg.height = h + lo.marginTop + lo.marginBottom;
    }
  });

}(musje.Layout, Snap));

/* global musje */

(function (Layout) {
  'use strict';

  var defineProperty = Object.defineProperty;

  var Header = Layout.Header = function (layout) {
    this._layout = layout;
    this.el = layout.body.el.g().addClass('mus-header');
    this.width = layout.body.width;
  };

  defineProperty(Header.prototype, 'width', {
    get: function () {
      return this._w;
    },
    set: function (w) {
      this._w = w;
    }
  });

  defineProperty(Header.prototype, 'height', {
    get: function () {
      return this._h;
    },
    set: function (h) {
      var layout = this._layout;
      layout.content.y = h ? h + layout.options.headerSep : 0;
      this._h = h;
    }
  });

}(musje.Layout));

/* global musje, Snap */

(function (Layout, Snap) {
  'use strict';

  var defineProperty = Object.defineProperty;

  var Content = Layout.Content = function (layout) {
    this._layout = layout;
    this.el = layout.body.el.g().addClass('mus-content');
    this.width = layout.body.width;

    var system = new Layout.System(this, layout.options);
    system.y = 0;
    system.height = 25;
    this.systems = [system];
  };

  Content.prototype._resizeBody = function () {
    var
      layout = this._layout,
      headerHeight = layout.header.height;

    layout.body.height = this.height +
            (headerHeight ? headerHeight + layout.options.headerSep : 0);
  };

  // Divide measures in timewise score into the systems.
  // Assign y, height, minWdith, and measures to each system.
  Content.prototype.flow = function (scoreMeasures) {
    var
      content = this,
      lo = this._layout.options,
      systems = this.systems,
      system = systems[0],
      width = content.width,
      height = 25,
      s = 0,
      x = 0;

    function y() {
      return s * (height + lo.systemSep);
    }

    scoreMeasures.forEach(function (measure) {
      var notCellWidth = (measure.barLeft.width + measure.barRight.width) / 2 + lo.measurePaddingLeft + lo.measurePaddingRight;
      x += measure.minWidth + notCellWidth;

      // Continue putting this measure in the system.
      if (x < width) {
        measure.system = system;
        system.measures.push(measure);
        x += lo.measurePaddingLeft;

      // New system
      } else {
        s++;
        system = systems[s] = new Layout.System(content, lo);
        system.y = y();
        system.height = height;
        measure.system = system;
        system.measures.push(measure);
        x = measure.minWidth + notCellWidth;
      }
    });

    s++;
    content.height = y() + height;

    systems.forEach(function (system) {
      system.flow();
    });
  };

  defineProperty(Content.prototype, 'y', {
    get: function () {
      return this._y;
    },
    set: function (y) {
      this._y = y;
      this.el.transform(Snap.matrix().translate(0, y));
      this._resizeBody();
    }
  });

  defineProperty(Content.prototype, 'width', {
    get: function () {
      return this._w;
    },
    set: function (w) {
      this._w = w;
    }
  });

  defineProperty(Content.prototype, 'height', {
    get: function () {
      return this._h;
    },
    set: function (h) {
      this._h = h;
      this._resizeBody();
    }
  });

}(musje.Layout, Snap));

/* global musje, Snap */

(function (Layout, Snap) {
  'use strict';

  var defineProperty = Object.defineProperty;

  function getPairs(measures) {
    return measures.map(function (measure) {
      return {
        width: measure.minWidth,
        measure: measure
      };
    }).sort(function (a, b) {
      return b.width - a.width;   // descending sort
    });
  }

  var System = Layout.System = function (content, lo) {
    this._lo = lo;
    this.el = content.el.g().addClass('mus-system');
    this.width = content.width;
    this.measures = [];
  };

  System.prototype.flow = function () {
    var
      system = this,
      x = 0;

    system._tuneMeasuresWidths();
    system.measures.forEach(function (measure, m) {
      measure.system = system;
      measure.index = m;
      measure.flow();
      measure.x = x;
      x += measure.width;
    });
  };

  System.prototype._tuneMeasuresWidths = function () {
    var
      pairs = getPairs(this.measures),
      length = pairs.length,
      widthLeft = this.width,
      itemLeft = length,
      i = 0,    // i + itemLeft === length
      width;

    while (i < length) {
      if (widthLeft >= pairs[i].width * itemLeft) {
        width = widthLeft / itemLeft;
        do {
          pairs[i].measure.width = width;
          i++;
        } while (i < length);
        break;
      } else {
        width = pairs[i].width;
        pairs[i].measure.width = width;
        widthLeft -= width;
        i++;
        itemLeft--;
      }
    }

    // measures.forEach(function (measure) {
    //   measure.el.rect(0, 0, measure.width, measure.height)
    //         .attr({ stroke: 'green', fill: 'none' });
    // });
  };

  defineProperty(System.prototype, 'y', {
    get: function () {
      return this._y;
    },
    set: function (y) {
      this._y = y;
      this.el.transform(Snap.matrix().translate(0, y));
    }
  });

  defineProperty(System.prototype, 'width', {
    get: function () {
      return this._w;
    },
    set: function (w) {
      this._w = w;
    }
  });

  defineProperty(System.prototype, 'height', {
    get: function () {
      return this._h;
    },
    set: function (h) {
      this._h = h;
    }
  });

}(musje.Layout, Snap));

/* global musje, Snap */

(function (musje, Snap) {
  'use strict';

  var
    defineProperty = Object.defineProperty,
    extend = musje.extend,
    Layout = musje.Layout;

  // @constructor Measure
  var Measure = Layout.Measure = function (measure, defs, lo) {
    this._defs = defs;
    this._lo = lo;

    extend(this, measure);
  };

  Measure.prototype.calcMinWidth = function () {
    var lo = this._lo, minWidth = 0;

    this.parts.forEach(function (cell) {
      minWidth = Math.max(minWidth, cell.minWidth);
    });

    this._padding = lo.measurePaddingLeft + lo.measurePaddingRight;
    this.minWidth = minWidth + this._padding;
  };

  Measure.prototype.flow = function () {
    var measure = this;
    measure.parts = measure.parts.map(function (cell) {
      cell.measure = measure;
      cell._x = measure.barLeft.width / 2 + measure._lo.measurePaddingRight;

      cell.y2 = measure.system.height;

      // cell.el.rect(0, -cell.height, cell.width, cell.height)
      //   .addClass('bbox');

      return cell;
    });
  };

  defineProperty(Measure.prototype, 'system', {
    get: function () {
      return this._s;
    },
    set: function (system) {
      this._s = system;
      this.el = system.el.g().addClass('mus-measure');
      this.height = system.height;
    }
  });

  defineProperty(Measure.prototype, 'width', {
    get: function () {
      return this._w;
    },
    set: function (w) {
      this._w = w;
      var padding = this._padding;
      this.parts.forEach(function (cell) {
        cell.width = w - padding;
      });
    }
  });

  defineProperty(Measure.prototype, 'x', {
    get: function () {
      return this._x;
    },
    set: function (x) {
      this._x = x;
      this.el.transform(Snap.matrix().translate(x, 0));
    }
  });

  defineProperty(Measure.prototype, 'barLeft', {

    // barLeft at first measure of a system:
    // |]  -> |
    // :|  -> |
    // :|: -> |:
    get: function () {
      var bar = this._bl;
      if (!bar) { return { width: 0, height: 0 }; }

      if (this.index === 0) {
        if (bar.value === 'end' || bar.value === 'repeat-end') {
          bar = new musje.Bar('single');
        } else if (bar.value === 'repeat-both') {
          bar = new musje.Bar('repeat-begin');
        }
      }
      bar.def = this._defs.get(bar);
      return bar;
    },

    set: function (bar) {
      this._bl = bar;
    }
  });

  defineProperty(Measure.prototype, 'barRight', {

    // barRight at last measure of a system:
    //  |: ->  |
    // :|: -> :|
    get: function () {
      var bar = this._br, system = this.system;
      if (!bar) { return { width: 0, height: 0 }; }

      if (system && this.index === system.measures.length - 1) {
        if (bar.value === 'repeat-begin') {
          bar = new musje.Bar('single');
        } else if (bar.value === 'repeat-both') {
          bar = new musje.Bar('repeat-end');
        }
      }
      bar.def = this._defs.get(bar);
      return bar;
    },

    set: function (bar) {
      this._br = bar;
    }
  });

}(musje, Snap));

/* global musje, Snap */

(function (CellPrototype, Snap) {
  'use strict';

  var defineProperty = Object.defineProperty;

  CellPrototype.flow = function (defs, lo) {
    var x = 0, minHeight;

    this.data.forEach(function (data) {
      var def = data.def = defs.get(data);
      data.x = x;
      data.y = 0;
      x += def.width + lo.musicDataSep;
      minHeight = Math.min(minHeight, def.height);
    });

    this.minWidth = x;
    this.minHeight = minHeight;
  };

  CellPrototype._reflow = function () {
    var cell = this;
    this.data.forEach(function (data) {
      data.x *= cell.width / cell.minWidth;
    });
  };

  defineProperty(CellPrototype, 'measure', {
    get: function () {
      return this._m;
    },
    set: function (measure) {
      this._m = measure;
      this.el = measure.el.g().addClass('mus-cell');
      this.height = measure.height;
    }
  });

  defineProperty(CellPrototype, 'width', {
    get: function () {
      return this._w;
    },
    set: function (w) {
      this._w = w;
      this._reflow();
    }
  });

  defineProperty(CellPrototype, 'x', {
    get: function () {
      return this._x;
    },
    set: function (x) {
      this._x = x;
      this.el.transform(Snap.matrix().translate(x, this.y2));
    }
  });

  defineProperty(CellPrototype, 'y2', {
    get: function () {
      return this._y2;
    },
    set: function (y2) {
      this._y2 = y2;
      this.el.transform(Snap.matrix().translate(this.x, y2));
    }
  });

}(musje.Cell.prototype, Snap));

/* global musje */

(function (musje) {
  'use strict';

  var defineProperty = Object.defineProperty;

  function extendClass(className) {
    defineProperty(musje[className].prototype, 'x', {
      get: function () {
        return this._x;
      },
      set: function (x) {
        this._x = x;
        if (this.el) {
          this.el.attr('x', x);
        }
      }
    });

    defineProperty(musje[className].prototype, 'y', {
      get: function () {
        return this._y;
      },
      set: function (y) {
        this._y = y;
        if (this.el) { this.el.attr('y', y); }
      }
    });

    defineProperty(musje[className].prototype, 'systemX', {
      get: function () {
        return this.x + this.cell.x + this.cell.measure.x;
      }
    });

    defineProperty(musje[className].prototype, 'width', {
      get: function () {
        return this.def.width;
      },
      // set: function (w) {
      //   this._w = w;
      // }
    });
  }

  ['Time', 'Bar', 'Note', 'Rest'].forEach(extendClass);


}(musje));

/* global musje, Snap */

(function (musje, Snap) {
  'use strict';

  var Renderer = musje.Renderer = function (svg, lo) {
    this._lo = musje.extend(musje.Layout.options, lo);
    this.layout = new musje.Layout(svg, this._lo);
  };

  Renderer.prototype.render = function (score) {
    this._score = score;
    this.layout.flow(score);

    this.renderHeader();
    this.renderContent();
  };

  Renderer.prototype.renderHeader = function () {
    var
      lo = this._lo,
      header = this.layout.header,
      el = header.el,
      width = header.width;

    el.text(width / 2, lo.titleFontSize, this._score.head.title)
      .attr({
        fontSize: lo.titleFontSize,
        fontWeight: lo.titleFontWeight,
        textAnchor: 'middle'
      });
    el.text(width, lo.titleFontSize * 1.5, this._score.head.composer)
      .attr({
        fontSize: lo.composerFontSize,
        fontWeight: lo.composerFontWeight,
        textAnchor: 'end'
      });

    header.height = el.getBBox().height;
  };

  Renderer.prototype.renderContent = function () {
    var lo = this._lo;

    this.layout.content.systems.forEach(function (system) {
      var measures = system.measures;
      measures.forEach(function (measure) {
        Renderer.renderBar(measure, lo);
        measure.parts.forEach(function (cell) {
          Renderer.renderCell(cell, lo);
        });
      });
    });
  };


  Renderer.renderCell = function (cell, lo) {
    cell.data.forEach(function (data) {
      switch (data.$name) {
      case 'Rest':  // fall through
      case 'Note':
        data.el = cell.el.g().transform(Snap.matrix()
                                .translate(data.x, data.y));
        data.el.use(data.def.pitchDef.el);
        Renderer.renderDuration(data, lo);
        if (data.$name === 'Note') {
          Renderer.renderTie(data);
        }
        break;
      case 'Time':
        data.el = cell.el.use(data.def.el).attr({
          x: data.x, y: data.y
        });
        break;
      }
    });
  };

  function tiePath(x1, y1, x2, y2) {
    var
      dx = x2 - x1,
      dy = y2 - y1,
      c1x = -0.1 * dx,
      c1y = -0.1 * dy,
      c2x = 1.1 * dx,
      c2y = 1.1 * dy;

    return Snap.format('M{x1},{y1}c{c1x},{c1y} {c2x},{c2y} {dx},{dy}c{c3x},{c3y} {c4x},{c4y} {negDx},{negDy}', {
      x1: x1,
      y1: y1,
      c1x: c1x,
      c1y: c1y - 8,
      c2x: c2x,
      c2y: c2y - 8,
      dx: dx,
      dy: dy,
      c3x: -c1x,
      c3y: -c1y - 10,
      c4x: -c2x,
      c4y: -c2y - 10,
      negDx: -dx,
      negDy: -dy
    });
  }

  Renderer.renderTie = function (note) {
    var
      next = note.tie.next,
      prev = note.tie.prev,
      system = note.cell.measure.system,
      noteDx,
      x1, x2, y1, y2;

    // Tie end
    if (prev && prev.cell.measure.system !== system) {
      x1 = note.def.pitchDef.stepCx;
      y1 = note.def.pitchDef.stepTop;
      x2 = - note.systemX - 3;
      note.el.path(tiePath(x1, y1, x2, y1 - 3));
    }

    if (next) {
      x1 = note.def.pitchDef.stepCx;
      y1 = note.def.pitchDef.stepTop;

      // Tie begin
      if (next.cell.measure.system !== system) {
        x2 = system.width - note.systemX + 3;
        note.el.path(tiePath(x1, y1, x2, y1 - 3));

      // Tie complete
      } else {
        noteDx = next.systemX - note.systemX;
        x2 = next.def.pitchDef.stepCx;
        y2 = next.def.pitchDef.stepTop;
        note.el.path(tiePath(x1, y1, noteDx + x2, y2));
      }
    }
  };


  musje.Score.prototype.render = function (svg, lo) {
    new Renderer(svg, lo).render(this);
  };

}(musje, Snap));

/* global musje, Snap */

(function (musje, Snap) {
  'use strict';

  function renderDots(el, x, radius, measureHeight) {
    var
      cy = measureHeight / 2,
      dy = measureHeight * 0.15;

    el.circle(x, cy - dy, radius);
    el.circle(x, cy + dy, radius);
  }

  function render(bar, measure, lo) {
    var el = measure.el.g().addClass('mus-barline');

    el.use(bar.def.el).transform(Snap.matrix().scale(1, measure.height));

    switch (bar.value) {
    case 'repeat-begin':
      renderDots(el, bar.width - lo.barlineDotRadius, lo.barlineDotRadius, measure.height);
      break;
    case 'repeat-end':
      renderDots(el, lo.barlineDotRadius, lo.barlineDotRadius, measure.height);
      break;
    case 'repeat-both':
      renderDots(el, bar.width - lo.barlineDotRadius, lo.barlineDotRadius, measure.height);
      renderDots(el, lo.barlineDotRadius, lo.barlineDotRadius, measure.height);
      break;
    }

    return el;
  }

  function translate(el, x) {
    el.transform(Snap.matrix().translate(x, 0));
  }

  // @param m {number} Measure index in measures.
  // @param len {number} Length of measures.
  musje.Renderer.renderBar = function (measure, lo) {
    var
      m = measure.index,
      len = measure.system.measures.length,
      bar = measure.barRight,
      el;

    if (bar.def) {
      el = render(bar, measure, lo);

      // Last measure in a system align end
      if (m === len - 1) {
        translate(el, measure.width - bar.width);

      // Others align middle
      } else {
        translate(el, measure.width - bar.width / 2);
      }
    }

    // First measure in a system, render right bar, align begin
    if (m === 0) {
      bar = measure.barLeft;
      if (bar.def) {
        render(bar, measure, lo);
      }
    }
  };

}(musje, Snap));

/* global musje, Snap */

(function (Renderer, Snap) {
  'use strict';

  function findEndBeamedNote(note, beamLevel) {
    var
      begin = note.index,
      cell = note.cell,
      i = begin + 1,
      next = cell.data[i];

    while (next && next.beams && next.beams[beamLevel] !== 'end') {
      i++;
      next = cell.data[i];
    }
    return next;
  }

  function x2(note) {
    var def = note.def;
    return def.pitchDef.width +
           def.durationDef.width * def.pitchDef.scale.x;
  }

  function renderUnderbar(note1, note2, y, lo) {
    note1.el.line(0, y, note2.x - note1.x + x2(note2), y)
           .attr('stroke-width', lo.typeStrokeWidth);
  }

  Renderer.renderDuration = function (note, lo) {
    var durationDef = note.def.durationDef;
    var pitchDef = note.def.pitchDef;

    var underbar = note.duration.underbar;
    var y = 0;

    // Whole and half notes
    if (note.duration.type < 4) {
      note.el.use(durationDef.el).attr({
        x: pitchDef.width,
        y: pitchDef.stepCy
      });

    // Quarter or shorter notes
    } else {

      // Add dots
      if (note.duration.dot) {
        note.el.g().transform(Snap.matrix().translate(pitchDef.width, 0))
          .use(durationDef.el).transform(pitchDef.matrix);
      }

      // Add underbars for eigth or shorter notes
      if (underbar) {
        for (var i = 0; i < underbar; i++) {
          if (note.beams && note.beams[i]) {
            if (note.beams[i] === 'begin') {
              renderUnderbar(note, findEndBeamedNote(note, i), y, lo);
            }
          } else {
            renderUnderbar(note, note, y, lo);
          }
          y -= lo.underbarSep;
        }
      }
    }
  };

}(musje.Renderer, Snap));

/* global musje, MIDI */

(function (musje, MIDI) {
  'use strict';

  if (!musje.Score) { return; }

  if (window.AudioContext) {
    var audioCtx = new window.AudioContext();
    var gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.5;  // set the volume
  }

  // var oscillator = audioCtx.createOscillator();
  // oscillator.connect(gainNode);
  // oscillator.type = 'square'; // sine | square | sawtooth | triangle | custom

  function playNote(time, dur, freq) {
    if (!audioCtx) { return; }

    var oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.connect(audioCtx.destination);
    oscillator.frequency.value = freq;
    oscillator.start(time);
    oscillator.stop(time + dur - 0.05);
  }

  function midiPlayNote(note, time) {
    var
      midiNumber = note.pitch.midiNumber,
      dur = note.duration.second;

    function play() {
      if (!note.tie.prev) {
        MIDI.noteOn(0, midiNumber, 100, 0);
      }
      if (!note.tie.next) {
        MIDI.noteOff(0, midiNumber, dur);
      }

      note.el.addClass('mus-playing');

      setTimeout(function () {
        note.el.removeClass('mus-playing');
      }, dur * 800 + 100);

      console.log('Play: ' + note, time, dur, midiNumber);
    }

    return setTimeout(play, time * 800);
  }

  var timeouts = [];

  musje.Score.prototype.play = function() {
    var
      measures = this.parts[0].measures,
      time = 0; //audioCtx.currentTime

    measures.forEach(function (cell) {
      cell.data.forEach(function (data) {
        switch (data.$name) {
        case 'Note':
          // playNote(time, dur, freq);
          timeouts.push(midiPlayNote(data, time));
          time += data.duration.second;
          break;
        case 'Rest':
          time += data.duration.second;
          break;
        }
      });
    });
  };

  musje.Score.prototype.stop = function () {
    timeouts.forEach(function (timeout) {
      clearTimeout(timeout);
    });
    timeouts = [];
  };

}(musje, MIDI));

//# sourceMappingURL=.tmp/musje.js.map