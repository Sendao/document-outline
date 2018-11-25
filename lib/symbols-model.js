const {Point, Range} = require('atom');
const {AbstractModel} =require('./abstract-model');
const tagsRead = require('./symbols-loader');

const path = require('path');

var files_tags = {}, files_tags_done = false;

class TagsModel extends AbstractModel {
  constructor(editorOrBuffer) {
    super(editorOrBuffer, null);
    //console.log("symbols: created.");
  }

  parse() {
    if( files_tags['ctags_read_complete'] != true ) {
      console.log("symbols: tried to parse before ready (" + Object.keys(files_tags).length + " entries).");
      return [];
    }
    //console.log("symbols: doing parse!");
    var rawHeadings=[], rhead;
    var text = this.buffer.getText();
    var linePos, lastLine=0, pText;
    var lastSpaces, lastWasSymbol=false, lastHadOpener=false, nSpaces, n, currentLevel=0
    var lastPointStart, lastPointEnd;
    let lineNo=0;
    var levelSpaces = [];
    var words;
    var TABSPACES = 2;

    // read filename
    var fn = normalPath( this.buffer.getPath() );
    // find the name in the tags list
    if( !(fn in files_tags) ) {
      console.warn("Couldn't find files_tags[" + fn + "] (ft has " + Object.keys(files_tags).length + " entries)");
      return [];
    }
    //console.info("Found files_tags[ " + fn + " ] = " + files_tags[fn].length);

    // scan for symbol+indentation change/scope change combinations:
    var taglist = files_tags[fn];
    while( (linePos=text.indexOf("\n", lastLine+1)) != -1 ) {
      // did we increase indentation here? alternately, is this line just a single {?
      pText = text.substr( lastLine+1, linePos-1-lastLine );

      if( pText[0] == '/' && pText[1] == '/' ) { // support the '/. at the beginning of the line indicates a comment' syntax
        continue;
      }

      nSpaces=0;
      for( n=0; n<pText.length; ++n ) {
        if( pText[n] == ' ' ) nSpaces++;
        else if( pText[n] == '\t' ) nSpaces += TABSPACES;
        else if( pText[n] == '\r' ) continue;
        else break;
      }
      //console.log("pText[0] = '" + pText[0] + "', spaces = " + nSpaces);

      var pTrim = pText.trim();
      if( pTrim == "{" || nSpaces > lastSpaces || lastHadOpener || pTrim == "" ) {
        if( lastWasSymbol ) {
          // make a heading
          var pStart = new Point(lineNo - 1, lastPointStart);
          var pEnd = new Point(lineNo - 1, lastPointEnd);
          rhead = {
            level: currentLevel+1,
            headingRange: new Range( pStart, pEnd ),
            plainText: lastWasSymbol,
            children: [],
            range: new Range( pStart, Point.INFINITY),
            startPosition: pStart,
            endPosition: Point.INFINITY
          };
          //console.log("Pushed " + lastWasSymbol);
          rawHeadings.push(rhead);
          // We may have increased a contextual level.
          if( nSpaces > lastSpaces || lastHadOpener ) {
            levelSpaces.push(nSpaces);
            currentLevel++;
            //console.log("Level = " + currentLevel + "(" + nSpaces + " spaces)");
          }
        }
      }
        // did we lose a level?
      if( pTrim != "" ) {
        while( currentLevel > 0 && nSpaces < levelSpaces[ currentLevel-1 ] ) {
          levelSpaces.pop();
          currentLevel--;
          //console.log("Level < " + currentLevel);
        }
      }

      // prepare for the next loop:

      // see if we have a symbol on _this_ line
      words = wordsOfAString(pTrim);
      console.log( words.join(",") );
      lastWasSymbol = false;
      for( n=0; n<words.length; ++n ) {
        if( words[n] in taglist ) {
          lastWasSymbol = words[n];
          lastPointStart = pText.indexOf( lastWasSymbol );
          lastPointEnd = lastPointStart + lastWasSymbol.length;
          break;
        }
      }

      // go to the next line.
      lastHadOpener = pTrim[ pTrim.length-1 ] == '{';
      lastLine = linePos;
      lastSpaces = nSpaces;
      ++lineNo;
    }
    console.log("Parsed " + rawHeadings.length + " headings.");

    return this._stackHeadings(rawHeadings);
  }

}

function wordsOfAString( str )
{
  var i, word="", words = [];

  for( i=0; i<str.length; ++i ) {
    if( isAlpha( str[i] ) ) {
      word += str[i];
    } else {
      if( word != "" )
        words.push(word);
      word = "";
    }
  }
  if( word != "" ) words.push(word);

  return words;
}

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

function isAlpha(value) {
  var upperBoundUpper = "A".charCodeAt(0);
  var lowerBoundUpper = "Z".charCodeAt(0);
  var upperBoundLower = "a".charCodeAt(0);
  var lowerBoundLower = "z".charCodeAt(0);
  var allowed_chars = "_";

  for (var i = 0; i < value.length; i++) {
    var char = value.charCodeAt(i);
    if ((char >= upperBoundUpper && char <= lowerBoundUpper) ||
      (char >= upperBoundLower && char <= lowerBoundLower))
      continue;
    if( allowed_chars.includes(char) ) continue;
    return false;
  }
  return true;
};

function readCtags() {
  tagsRead( 'tags', files_tags, files_tags_done );
  /* -- doesn't work -- ctags doesn't work
  stream = ctags.createReadStream('./tags');
  stream.on('data', (newtags) => {
    for( var tg in newtags ) {
      var fn = normalPath(tg.file);
      if( !(fn in files_tags) ) files_tags[fn] = {};
      files_tags[ fn ].push( tg.name );
    }
  });
  */
}

readCtags();

module.exports = {  TagsModel }
