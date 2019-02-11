var crc = {
    table: new Uint32Array(256),

    initialize: function() {
      // Pre-generate crc32 polynomial lookup table
      for(var i=256; i--;)
      {
        var tmp = i;
        for(var k=8; k--;)
        {
          tmp = tmp & 1 ? 3988292384 ^ tmp >>> 1 : tmp >>> 1;
        }
        this.table[i] = tmp;
      }
    },

    calculate: function (data) {
      var crc = -1; // Begin with all bits set ( 0xffffffff )
      for(var i=0, l=data.length; i<l; i++)
      {
        crc = crc >>> 8 ^ this.table[ crc & 255 ^ data[i] ];
      }
      return (crc ^ -1) >>> 0; // Apply binary NOT
    }
 };