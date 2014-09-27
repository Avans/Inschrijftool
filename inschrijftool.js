Courses = new Mongo.Collection("courses");
Enrollments = new Mongo.Collection("enrollments");

if (Meteor.isClient) {

  Template.enroll.helpers({
    course: function () {
      return Courses.find({'url': window.location.pathname});
    }
  });


}