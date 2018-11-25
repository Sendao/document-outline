var fs = require('fs');
var path = require('path');

var project_root = false;

function findProjectRoot()
{
  var paths = atom.project.getPaths();
  var shortest = false;

  for( var i of paths ) {
    if( !shortest || i.length < shortest.length )
      shortest = i;
  }
  return normalPath(shortest);
}

function normalPath( fn )
{
  var parts, wasAbs=false;
  fn = path.normalize(fn);
  if( fn.indexOf('/') != -1 ) {
    parts = fn.split( path.posix.sep );
    wasAbs = path.posix.isAbsolute(fn);
  } else {
    parts = fn.split( path.win32.sep );
    wasAbs = path.win32.isAbsolute(fn);
  }
  var stx = "";
  if( !wasAbs ) {
    if( project_root === false ) project_root = findProjectRoot();
    var stx = project_root + path.posix.sep;
  }
  return stx + parts.join( path.posix.sep );
}

function parseFileTo(tags)
{
  var alltagtypes = [];
  var readVars = atom.config.get("document-outline.showVariables");
  //var nonvars = [ 'c', 'f', 'S', 't' ];
  var vartypes = [ 'v', 'p', 'u' ];

  var i, l = atom.project.getPaths();
  var tagFileName = null;

  for( i=0; i<l.length; ++i ) {
    if( fs.existsSync( l[i] + path.sep + "tags" ) ) {
      tagFileName = l[i] + path.sep + "tags";
      break;
    }
  }
  if( tagFileName == null ) {
    console.log("No tags file found.\n", l);
    return;
  }
  console.log("Using tags file '" + tagFileName + "'");

  fs.readFile( tagFileName, 'utf8', function(err, contents) {
    if( err ) throw err;

    var lines = contents.split("\n");
    var i, n, line;
    var words, wordNo, wordStart, found;
    var used_tags=[], valid_tags=0;
    for( i=0; i<lines.length; ++i ) {
      // parse the line:
      line = lines[i];
      if( line[0] == '!' ) continue;
      words = [];
      wordNo = 0;
      found=false;
      wordStart = 0;
      for( n=0; n< line.length; ++n ) {
        if( line[n] == '\t' ) {
          words[wordNo] = line.substr( wordStart, n-wordStart );
          wordStart = n+1;
          wordNo++;
          if( wordNo > 1 ) break;
        }
      }
      n++;
      if( words.length < 2 ) {
        if( i+1 >= lines.length-1 ) // done
          break;
        console.log("Invalid tags file line #" + i + "/" + lines.length);
        console.log(lines[i]);
        break;
      }

      if( line[n] == '/' ) {
        n++;
      } else {
        console.log("Invalid tags file line #" + i + "/" + lines.length + " - does not match regexp format");
        console.log(line.substr(n))
      }

      var j = line.lastIndexOf("/");
      words[2] = line.substr( n, j-n );
      n = j;

      while( line[n] != '\t' ) n++; // handle universal c-tags
      while( line[n] == '\t' ) n++;

      words[3] = line[n];

      if( !readVars && vartypes.indexOf(words[3]) != -1 )
        continue;

      if( words[2][0] == '^' ) { // yeah, kind of obvious anyway, ctags...
        words[2] = words[2].slice(1);
      }
      if( words[2][ words[2].length-1 ] == '$' ) {
        words[2] = words[2].substr(0, words[2].length-1 );
      }

      //console.log("Found line: " + words.join(","));
      words[1] = normalPath(words[1]);
      /*if( words[1].includes("web")) {
        console.log("One of the path strings: '" + words[1] + "'");
      }*/
      if( !(words[1] in tags) ) tags[ words[1] ] = {};
      if( !(words[0] in tags[words[1]]) ) tags[ words[1] ][ words[0] ] = {};
      if( !(words[2] in tags[words[1]][words[0]]) ) tags[ words[1] ][ words[0] ][ words[2] ] = [];
      if( tags[words[1]][words[0]][words[2]].indexOf(words[3]) == -1 ) // sometimes there are duplicates; drop them.
        tags[ words[1] ][ words[0] ][ words[2] ].push( words[3] );
      if( alltagtypes.indexOf(words[3]) == -1 ) alltagtypes.push( words[3] );
        // !! tags[ filename ][ symbol ][ regexp ] = [ types ]
      valid_tags++;
    }
    //console.log("Processed " + lines.length + " tag lines.");
    console.log( valid_tags + " tags found in " + Object.keys(tags).length + " files." );
    tags[ 'ctags_read_complete' ] = true;
    console.log( alltagtypes );
  });
}

module.exports = parseFileTo;
