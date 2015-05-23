Courses = new Mongo.Collection("courses");
Enrollments = new Mongo.Collection("enrollments");
Unavailable = new Mongo.Collection("unavailable");

if(Meteor.isServer) {
  Meteor.publish("user", function () {
    return Meteor.users.find({_id: this.userId}, {fields: {'services.avans': 1,}});
  });
  Meteor.publish("course", function (url) {
    return Courses.find({'url': url});
  });
  Meteor.publish("enrollments", function (url) {
    return Enrollments.find({courseId: Courses.findOne({'url': url})._id});
  });
  Meteor.publish("unavailable", function (url) {
    return Unavailable.find({courseId: Courses.findOne({'url': url})._id});
  });
}
Router.route('/:url.ics', function (f) {
  var course = Courses.findOne({'url': '/'+this.params.url});
  var enrollments = Enrollments.find({courseId: course._id}).fetch();

  // Dates to UTC
  var dates = course.days.map(function(day_string) {
    // Guess month
    var month = 0;
    var months = [/jan/i, /feb/i, /maart/i, /apr/i, /mei/i, /jun/i, /jul/i, /aug/i, /sep/i, /okt/i, /nov/i, /dec/i];
    for(var i = 0; i < months.length; i++) {
      if(day_string.name.search(months[i]) !== -1) {
        month = i;
      }
    }

    // Guess day
    var day = 1;
    try {
      day = parseInt(day_string.name.match(/[0-9]+/)[0]);
    } catch (e) {
    }

    // Guess year
    var current_year = (new Date()).getFullYear();
    var year = current_year;
    if(Math.abs(new Date(current_year+1, month, day) - new Date()) < Math.abs(new Date(current_year, month, day) - new Date())) {
      year = current_year + 1;
    }

    return Date.UTC(year, month, day);
  });

  // Times to UTC
  var times = course.timeslots.map(function(timeslot) {
    var range = timeslot.name.match(/[0-9]{1,2}:[0-9]{1,2}/g);
    range = range.map(function time(string) {
      var hour = string.split(':')[0]*60*60*1000;
      var minute = string.split(':')[1]*60*1000;
      return hour + minute;
    });
    return range;
  });

  // Output
  content = 'BEGIN:VCALENDAR\r\n';
  content += 'VERSION:2.0\r\n';
  content += 'PRODID:-//hacksw/handcal//NONSGML v1.0//EN\r\n';
  content += 'BEGIN:VTIMEZONE\r\n';
  content += 'TZID:Europe/Amsterdam\r\n';
  content += 'X-LIC-LOCATION:Europe/Amsterdam\r\n';
  content += 'BEGIN:DAYLIGHT\r\n';
  content += 'TZOFFSETFROM:+0100\r\n';
  content += 'TZOFFSETTO:+0200\r\n';
  content += 'TZNAME:CEST\r\n';
  content += 'DTSTART:19700329T020000\r\n';
  content += 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\n';
  content += 'END:DAYLIGHT\r\n';
  content += 'BEGIN:STANDARD\r\n';
  content += 'TZOFFSETFROM:+0200\r\n';
  content += 'TZOFFSETTO:+0100\r\n';
  content += 'TZNAME:CET\r\n';
  content += 'DTSTART:19701025T030000\r\n';
  content += 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\n';
  content += 'END:STANDARD\r\n';
  content += 'END:VTIMEZONE\r\n';

  for(var i = 0; i < enrollments.length; i++) {
    var start_timestamp = dates[enrollments[i].day] + times[enrollments[i].timeslot][0];
    var end_timestamp = dates[enrollments[i].day] + times[enrollments[i].timeslot][1];
    var student = Meteor.users.findOne({_id: enrollments[i].studentId});

    function date(d) {
      var d = new Date(d);

      function dd(number) {
        if(number < 10) {
          return '0'+number;
        } else {
          return number;
        }

      }
      return d.getUTCFullYear() + '' + dd(d.getUTCMonth()+1) + '' + dd(d.getUTCDate())
              + 'T' + dd(d.getUTCHours()) + '' + dd(d.getUTCMinutes()) + '00';
    }

    content += 'BEGIN:VEVENT\r\n';
    content += 'DTSTART;TZID=Europe/Amsterdam:' + date(start_timestamp) + '\r\n'
    content += 'DTEND;TZID=Europe/Amsterdam:' + date(end_timestamp) + '\r\n'
    content += 'SUMMARY:' + student.profile.name + '\r\n'
    content += 'LOCATION:' + enrollments[i].extra + '\r\n'
    content += 'END:VEVENT\r\n'
  }
  content += 'END:VCALENDAR'

  this.response.writeHead(200, {
    'Content-Type': 'text/calendar; charset-utf-8',
    'Content-Disposition': 'inline; filename='+this.params.url+'.ics',
    'Cache-Control': 'max-age=3600, private, must-revalidate',
  });
  this.response.end(content);
}, {where: 'server'});

Router.route('/:page', function () {
  this.render('enroll');
});

var number_of_slots = new Deps.Dependency();

function isTeacher() {
    var user = Meteor.user();
    if(user) {
      return user.services.avans.employee == 'true';
    } else {
      return false;
    }
}

Courses.allow({
  update: isTeacher,
  insert: isTeacher,
});

Unavailable.allow({
  update: isTeacher,
  insert: isTeacher,
  remove: isTeacher,
})

Meteor.methods({
  enroll: function(course, day, timeslot) {
    if(  !Enrollments.findOne({courseId: course._id, day: day, timeslot: timeslot})
      && !Unavailable.findOne({courseId: course._id, day: day, timeslot: timeslot}))
      Enrollments.upsert({studentId: Meteor.user()._id, courseId: course._id}, {$set: {day: day, timeslot: timeslot}}, {upsert: true})
  },
  unroll: function(id) {
    if(isTeacher() || Enrollments.findOne({_id: id, studentId: Meteor.user()._id})) {
      Enrollments.remove({_id: id});
    }
  },
  extra: function(course, extra) {
    Enrollments.update({studentId: Meteor.user()._id, courseId: course._id}, {$set: {extra: extra.substring(0, 100)}})
  },
  toggleUnavailable: function(course, day, timeslot) {
    if(isTeacher()) {
      if(Unavailable.findOne({courseId: course._id, day: day, timeslot: timeslot})) {
        Unavailable.remove({courseId: course._id, day: day, timeslot: timeslot});
      } else {
        Unavailable.insert({courseId: course._id, day: day, timeslot: timeslot});
      }
    }
  },
  removeCourse: function(course) {
    if(isTeacher()) {
      Courses.remove({_id: course._id});
      Unavailable.remove({courseId: course._id});
      Enrollments.remove({courseId: course._id});
    }
  }
})

if (Meteor.isClient) {

  course = function() {
    return Courses.findOne({'url': url()});
  }

  course_inert = function() {
    return Courses.findOne({'url': url()}, {reactive: !isTeacher()});
  }

  enrollments = function() {
    return Enrollments.find();
  }

  function url() {
    return window.location.pathname;
  }

  Meteor.subscribe("user");
  Meteor.subscribe("course", url());
  Meteor.subscribe("enrollments", url());
  Meteor.subscribe("unavailable", url());

  Template.enroll.helpers({
    url: function() {
      return url();
    },

    isTeacher: function() {
      return isTeacher();
    },

    course: function () {
      return course();
    },

    cal_url: function() {
      return Meteor.absoluteUrl(course().url.substring(1) + '.ics').replace('http://', '');
    },

    days: function() {
      number_of_slots.depend();
      return course_inert().days.map(function(doc, index, cursor) {
        return _.extend(doc, {index: index});
      });
    },

    timeslots: function() {
      number_of_slots.depend();
      return course_inert().timeslots.map(function(doc, index, cursor) {
        return _.extend(doc, {index: index});
      });
    },

    maxNumberOfStudents: function() {
      return course().days.length * course().timeslots.length - Unavailable.find({courseId: course()._id}).count();
    },

    maxNumberOfStudentsInDuos: function() {
      return Template.enroll.__helpers[' maxNumberOfStudents']() * 2;
    },

    enrollments: function() {
      return enrollments();
    },
    enrollmentInTimeslot: function(day, timeslot) {
      return Enrollments.findOne({courseId: course_inert()._id, day: day, timeslot: timeslot})
    },
    isUnavailableInTimeslot: function(day, timeslot) {
      return Unavailable.findOne({courseId: course_inert()._id, day: day, timeslot: timeslot})
    },
  });

  Template.enrollment.helpers({
    student: function() {
      return Meteor.users.findOne(this.studentId)
    },
    isOwnEnrollment: function() {
      if(!Meteor.user())
        return false;

      return this.studentId == Meteor.user()._id;
    },
    canUnroll: function() {
      return Template.enrollment.__helpers[" isOwnEnrollment"].call(this) || isTeacher();
    }
  });

  Template.enroll.events({
    'click .makecourse': function() {
      Courses.insert({
        'url': url(),
        'name': 'Naamloos',
        'number_of_days': 0,
        'number_of_timeslots': 0,
        'days': [],
        'timeslots': [],
      });
    },
    'click .deletecourse': function() {
      if(confirm('Wil je deze pagina met alle inschrijvingen verwijderen?')) {
        Meteor.call('removeCourse', course());
      }
    },

    'input .course-name': function(e) {
      Courses.update(course()._id, {$set:{name:e.target.value}});
    },
    'click .enroll': function(e) {
      var day = $(e.target).data('day-index');
      var timeslot = $(e.target).data('timeslot-index');

      Meteor.call('enroll', course(), day, timeslot);
    },
    'contextmenu .enroll,.unavailable': function(e) {
      if(isTeacher()) {
        var day = $(e.target).data('day-index');
        var timeslot = $(e.target).data('timeslot-index');

        Meteor.call('toggleUnavailable', course(), day, timeslot);
        e.preventDefault();
      }
    },
    'click .unroll': function(e) {
      Meteor.call('unroll', this._id);
    },
    'input .extra': function(e) {
      Meteor.call('extra', course(), e.target.value);
    },
    'input .day': function(e) {
      var day = $(e.target).data('day-index');
      var days = course().days;
      days[day].name = e.target.value;
      Courses.update(course()._id, {$set: {days: days}});
    },
    'input .number_of_days': function(e) {
      var number_of_days = e.target.value;
      var days = course().days;
      while(days.length < number_of_days) {
        days.push({'name': ''});
      }
      days = days.slice(0, number_of_days);
      Courses.update(course()._id, {$set: {days: days, number_of_days: number_of_days}});
      number_of_slots.changed();
    },
    'input .timeslot': function(e) {
      var timeslot = $(e.target).data('timeslot-index');
      var timeslots = course().timeslots;
      timeslots[timeslot].name = e.target.value;
      Courses.update(course()._id, {$set: {timeslots: timeslots}});
    },
    'input .number_of_timeslots': function(e) {
      var number_of_timeslots = e.target.value;
      var timeslots = course().timeslots;
      while(timeslots.length < number_of_timeslots) {
        timeslots.push({'name': ''});
      }
      timeslots = timeslots.slice(0, number_of_timeslots);
      Courses.update(course()._id, {$set: {timeslots: timeslots, number_of_timeslots: number_of_timeslots}});
      number_of_slots.changed();
    },
    'click #timeslots-generate': function(e) {
      var start_time = $('#timeslots-start').val();
      var minutes_per_timeslot = $('#timeslots-minutes').val()*1;
      var time_in_minutes = (start_time.substring(0,2) * 60) + start_time.substring(3, 5)*1;

      var timeslots = course().timeslots;

      function toTime(time) {
        return Math.floor(time / 60) + ':' + (time % 60 < 10 ? '0' : '') + (time % 60);
      }

      for(i in timeslots) {
        timeslots[i].name = toTime(time_in_minutes) + '-' + toTime(time_in_minutes + minutes_per_timeslot);
        time_in_minutes += minutes_per_timeslot;
        time_in_minutes = time_in_minutes % (24*60);
      }
      Courses.update(course()._id, {$set: {timeslots: timeslots}});
      number_of_slots.changed();
    },
  })


}