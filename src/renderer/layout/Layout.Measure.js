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
