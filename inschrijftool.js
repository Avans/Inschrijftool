Courses = new Mongo.Collection("courses");
Enrollments = new Mongo.Collection("enrollments");

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
/*  setUnavailable: function(course, day, timeslot, unavailable) {
    if(unavailable) {
      Unavailable.upsert({courseId: course._id, day: day, timeslot: timeslot});
    } else {
      Unavailable.delete({courseId: course._id, day: day, timeslot: timeslot});
    }
  },
  */
})

if (Meteor.isClient) {

  course = function() {
    return Courses.findOne({'url': Template.enroll.url()});
  }

  enrollments = function() {
    return Enrollments.find();
  }

  Template.enroll.helpers({
    url: function() {
      return window.location.pathname;
    },

    isTeacher: function() {
      var user = Meteor.user();
      if(user) {
        return user.services.avans.employee == 'true';
      } else {
        return false;
      }
    },

    course: function () {
      return course();
    },

    days: function() {
      return course().days.map(function(doc, index, cursor) {
        return _.extend(doc, {index: index});
      });
    },

    timeslots: function() {
      return course().timeslots.map(function(doc, index, cursor) {
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
      return Enrollments.findOne({courseId: course()._id, day: day, timeslot: timeslot})
    }
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
      return Template.enrollment.isOwnEnrollment.call(this) || Template.enroll.isTeacher();
    }
  })

  Template.enroll.events({
    'click .makecourse': function() {
      Courses.insert({
        'url': Template.enroll.url(),
        'name': 'Naamloos',
        'number_of_days': 0,
        'number_of_timeslots': 0,
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
    },
  })


}