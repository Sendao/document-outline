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

function parseFileTo(tagFile, tags, tags_done)
{
  tags_done = false;

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
          if( wordNo == 0 ) {
            words[0] = line.substr( wordStart, n-wordStart );
            wordStart = n+1;
            wordNo++;
            //console.log("words[0] = " + words[0]);
          } else {
            words[1] = line.substr( wordStart, n-wordStart );
            found=true;
            //console.log("words[1] = " + words[1]);
            break;
          }
        }
      }
      if( !found ) {
        if( i+1 >= lines.length-1 ) // done
          break;
        console.log("Invalid tags file line #" + i + "/" + lines.length);
        console.log(lines[i-1], "\n", lines[i], "\n", lines[i+1], "\n");
        break;
      }
      line = line.trim();
      found=false;
      for( n=line.length-1; n>0; --n ) {
        if( line[n] == '\t' ) {
          words[2] = line.substr( n );
          //console.log("words[2] = " + words[2]);
          found=true;
          break;
        }
      }
      if( !found ) {
        console.log("Invalid tags file line #" + i + " - missing type");
        break;
      }
      //console.log("Found line: " + words.join(","));
      words[1] = normalPath(words[1]);
      /*if( words[1].includes("web")) {
        console.log("One of the path strings: '" + words[1] + "'");
      }*/
      if( !(words[1] in tags) ) tags[ words[1] ] = {};
      if( words[0] in tags[ words[1] ] ) continue; // sometimes duplicate symbols occur, which is really strange, but whatever. let's flip the default to acknowledge it.
      tags[ words[1] ][ words[0] ] = [ words[1], words[2] ]; // tags[filename][tagname] = [ filename, type ]
    }
    //console.log("Processed " + lines.length + " tag lines.");
    console.log( lines.length + " tags found in " + Object.keys(tags).length + " files." );
    tags[ 'ctags_read_complete' ] = true;
  });
}

module.exports = parseFileTo;
