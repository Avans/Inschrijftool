Courses = new Mongo.Collection("courses");
Enrollments = new Mongo.Collection("enrollments");
Unavailable = new Mongo.Collection("unavailable");

var number_of_slots = new Deps.Dependency();

Meteor.methods({
  enroll: function(course, day, timeslot) {
    if(!Enrollments.findOne({courseId: course._id, day: day, timeslot: timeslot}))
      Enrollments.upsert({studentId: Meteor.user()._id, courseId: course._id}, {$set: {day: day, timeslot: timeslot}}, {upsert: true})
  },
  unroll: function(id) {
    Enrollments.remove({_id: id});
  },
  extra: function(course, extra) {
    Enrollments.update({studentId: Meteor.user()._id, courseId: course._id}, {$set: {extra: extra.substring(0, 100)}})
  },
  toggleUnavailable: function(course, day, timeslot) {
    if(Unavailable.findOne({courseId: course._id, day: day, timeslot: timeslot})) {
      Unavailable.remove({courseId: course._id, day: day, timeslot: timeslot});
    } else {
      Unavailable.insert({courseId: course._id, day: day, timeslot: timeslot});
    }
  },
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

  function isTeacher() {
      var user = Meteor.user();
      if(user) {
        return user.services.avans.employee == 'true';
      } else {
        return false;
      }
  }

  function url() {
    return window.location.pathname;
  }

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
      return course().days.length * course().timeslots.length
    },

    maxNumberOfStudentsInDuos: function() {
      return course().days.length * course().timeslots.length * 2;
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
        'number_of_days': 5,
        'number_of_timeslots': 5,
        'days': [],
        'timeslots': [],
      });
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